/* BelezaPro D-3 — core/plano-limites.js
 * Extraído de app.bundle.js (FILE: plano-limites.js).
 *
 * ORDEM OBRIGATÓRIA:
 *   core/constants.js → core/utils.js → app.bundle.js → core/plano-limites.js
 * Motivo: getPlanoAtual/verificarLimite leem `state` (definido no bundle).
 *
 * Dependências: PLANOS, WHATSAPP_NUMBER (constants); toast, openModal, closeModal (utils);
 *   state, getProfissionaisAtivos (bundle, runtime).
 * Ver docs/D3_PLANO_LIMITES.md
 */

// ====================================================================
//  plano-limites.js — extraído do app.js (Fase C da modularização)
//  Conteúdo: Planos, trial e limites de uso (getPlanoAtual, getLimites, isTrialAtivo, verificarLimite, upgradePara)
//  Linhas originais: 1-80
//  Carregar depois de core-*.js, db-indexeddb.js, sync-*.js, auth-supabase.js
// ====================================================================
// ====================================================================
//  UTILITÁRIOS — movidos para core-utils.js (Fase A da modularização)
//  SUPABASE (client, auth listener, checkSession, getAuthHeaders,
//  garantirSalaoRemoto, sincronizarConfigDoServidor, login) — movidos
//  para auth-supabase.js (Fase B da modularização)
// ====================================================================

// Constantes movidas para core-constants.js: WHATSAPP_NUMBER, IA_EDGE_URL,
// STORE_TO_TABLE, SYNC_QUEUE_KEY
// getSyncQueue/saveSyncQueue/atualizarIndicadorSync/addToSyncQueue
// movidos para sync-queue.js (Fase B da modularização)

// getAuthHeaders movido para auth-supabase.js (Fase B da modularização)

// supabaseUpsert/supabaseDelete/supabaseGetAll/toSupabaseFormat/
// fromSupabaseFormat/carregarDoSupabase movidos para sync-rest.js
// (Fase B da modularização)

// ====================================================================
//  PLANOS E LIMITES
// ====================================================================
// PLANOS movido para core-constants.js

function getPlanoAtual() {
  if (typeof state === 'undefined' || !state.config) return 'trial';
  return state.config.plano || 'trial';
}

function getLimites(plano) {
  if (typeof PLANOS === 'undefined' || !PLANOS) return { agendamentos: 0, clientes: 0, profissionais: 0, iaDia: 0 };
  return PLANOS[plano] || PLANOS.trial;
}

function getDiasTrialRestantes() {
  if (!state.config.trialInicio) return 14;
  const raw = String(state.config.trialInicio);
  const inicio = (raw.includes('T') || raw.includes(' '))
    ? new Date(raw.replace(' ', 'T'))
    : new Date(raw + 'T00:00:00');
  if (isNaN(inicio.getTime())) return 14;
  const agora = new Date();
  const diff = Math.floor((agora - inicio) / (1000 * 60 * 60 * 24));
  return Math.max(0, 14 - diff);
}

function isTrialAtivo() {
  const p = getPlanoAtual();
  if (p !== 'trial') return false;
  return getDiasTrialRestantes() > 0;
}

function verificarLimite(tipo) {
  const plano = getPlanoAtual();
  const limite = getLimites(plano)[tipo];
  if (limite === Infinity) return true;
  let total = 0;
  switch (tipo) {
    case 'agendamentos':
      total = state.agendamentos.length;
      break;
    case 'clientes':
      total = state.clientes.length;
      break;
    case 'profissionais':
      // ET4-P1-05: contar apenas ativos (soft-delete não consome limite)
      if (typeof getProfissionaisAtivos === 'function') {
        total = getProfissionaisAtivos().length;
      } else {
        total = (state.profissionais || []).filter(function (p) {
          return p && p.ativo !== false && p.ativo !== 0 && p.ativo !== 'false';
        }).length;
      }
      break;
  }
  if (total >= limite) {
    mostrarModalUpgrade(`Limite de ${tipo} atingido (${limite}). Faça upgrade para continuar.`);
    return false;
  }
  return true;
}

function mostrarModalUpgrade(mensagem) {
  if (!mensagem) mensagem = 'Atingiu o limite do seu plano actual. Escolha um plano para continuar.';
  const el = document.getElementById('upgrade-mensagem');
  if (el) el.textContent = mensagem;
  openModal('modal-upgrade');
}

/** Copia texto para a área de transferência com fallback para ambientes sem Clipboard API. */
async function copiarTextoSeguro(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch (_) { /* continua para fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch (_) {
    return false;
  }
}

/**
 * Abre WhatsApp com mensagem pré-preenchida.
 * Se popup for bloqueado ou falhar, copia a mensagem e informa via toast.
 * @returns {Promise<{ok: boolean, metodo: 'window'|'clipboard'|'manual'}>}
 */
async function abrirWhatsAppVenda(mensagem) {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensagem)}`;
  let win = null;
  try {
    win = window.open(url, '_blank', 'noopener,noreferrer');
  } catch (_) { /* ignore */ }

  if (!win || win.closed) {
    const copiado = await copiarTextoSeguro(mensagem);
    if (copiado) {
      if (typeof toast === 'function') {
        toast('Não foi possível abrir o WhatsApp. Mensagem copiada — cole na conversa.', 'warning');
      }
      return { ok: true, metodo: 'clipboard' };
    }
    if (typeof toast === 'function') {
      toast('Abra o WhatsApp e envie a mensagem de adesão manualmente.', 'error');
    }
    return { ok: false, metodo: 'manual' };
  }
  return { ok: true, metodo: 'window' };
}

async function upgradePara(plano) {
  if (!plano) {
    if (typeof toast === 'function') toast('Plano inválido', 'error');
    return;
  }
  const salao = (typeof state !== 'undefined' && state.config && state.config.storeName) ? state.config.storeName : '—';
  const actual = (typeof getPlanoAtual === 'function') ? getPlanoAtual() : '—';
  const msg =
    `Olá, quero assinar o plano ${plano} do BeautyPro. Salão: ${salao} | Plano actual: ${actual}`;
  await abrirWhatsAppVenda(msg);
  closeModal('modal-upgrade');
}

/** Liga os botões data-upgrade-plano (CSP-safe; sem onclick inline). */
function bindUpgradeButtons() {
  document.querySelectorAll('[data-upgrade-plano]').forEach((btn) => {
    if (btn.dataset.bpUpgradeBound) return;
    btn.dataset.bpUpgradeBound = '1';
    btn.addEventListener('click', () => {
      const plano = btn.getAttribute('data-upgrade-plano');
      if (plano) upgradePara(plano);
    });
  });

  const contato = document.getElementById('modal-upgrade-contato');
  if (contato && !contato.dataset.bpUpgradeBound) {
    contato.dataset.bpUpgradeBound = '1';
    contato.addEventListener('click', async () => {
      const salao = (typeof state !== 'undefined' && state.config && state.config.storeName) ? state.config.storeName : '—';
      const actual = (typeof getPlanoAtual === 'function') ? getPlanoAtual() : '—';
      const msg =
        `Olá, quero assinar um plano do BeautyPro. Salão: ${salao} | Plano actual: ${actual}`;
      await abrirWhatsAppVenda(msg);
      closeModal('modal-upgrade');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindUpgradeButtons);
} else {
  bindUpgradeButtons();
}

// API pública (chamadas programáticas / compatibilidade)
window.upgradePara = upgradePara;
window.abrirWhatsAppVenda = abrirWhatsAppVenda;

/* D-3: API pública em window (scripts clássicos + UI/features) */
if (typeof window !== 'undefined') {
  window.getPlanoAtual = getPlanoAtual;
  window.getLimites = getLimites;
  window.getDiasTrialRestantes = getDiasTrialRestantes;
  window.isTrialAtivo = isTrialAtivo;
  window.verificarLimite = verificarLimite;
  window.mostrarModalUpgrade = mostrarModalUpgrade;
  window.upgradePara = upgradePara;
  window.abrirWhatsAppVenda = abrirWhatsAppVenda;
  window.bindUpgradeButtons = bindUpgradeButtons;
}

