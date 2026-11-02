/**
 * BELEZAPRO — regras de plano (puro).
 * Espelha PLANOS / getLimites / verificarLimite (lógica de contagem).
 * Fonte de verdade de comportamento: core-constants.js + plano-limites.js
 * Incremento F2-01: extrair para teste sem DOM.
 */

export const PLANOS = {
  trial: {
    label: 'Plano Gratuito',
    badgeClass: 'plano-trial',
    agendamentos: 60,
    clientes: 30,
    profissionais: 1,
    iaDia: 0,
  },
  starter: {
    label: 'Starter',
    badgeClass: 'plano-starter',
    agendamentos: 200,
    clientes: 150,
    profissionais: 2,
    iaDia: 0,
  },
  pro: {
    label: 'Pro',
    badgeClass: 'plano-pro',
    agendamentos: Infinity,
    clientes: Infinity,
    profissionais: 8,
    iaDia: 5,
  },
  premium: {
    label: 'Premium',
    badgeClass: 'plano-premium',
    agendamentos: Infinity,
    clientes: Infinity,
    profissionais: Infinity,
    iaDia: Infinity,
  },
};

/** @param {string} plano */
export function getLimites(plano) {
  return PLANOS[plano] || PLANOS.trial;
}

/**
 * Soft-active: mesma regra que isProfissionalAtivo / isServicoAtivo / bpClientesActivos.
 * @param {{ ativo?: unknown } | null | undefined} entity
 */
export function isEntityActive(entity) {
  if (!entity) return false;
  return entity.ativo !== false && entity.ativo !== 0 && entity.ativo !== 'false';
}

/**
 * Conta entidades activas (soft delete não consome limite de profissionais).
 * @param {Array<{ ativo?: unknown }>} list
 */
export function countActive(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter(isEntityActive).length;
}

/**
 * Pode criar mais um recurso deste tipo?
 * @param {'agendamentos'|'clientes'|'profissionais'} tipo
 * @param {{ agendamentos?: number, clientes?: number, profissionais?: number }} totals
 * @param {string} plano
 */
export function canCreateWithinPlan(tipo, totals, plano) {
  const limites = getLimites(plano);
  const limite = limites[tipo];
  if (limite === Infinity) return true;
  let total = 0;
  if (tipo === 'agendamentos') total = totals.agendamentos ?? 0;
  else if (tipo === 'clientes') total = totals.clientes ?? 0;
  else if (tipo === 'profissionais') total = totals.profissionais ?? 0;
  else return false;
  return total < limite;
}

/**
 * Dias de trial restantes (espelha getDiasTrialRestantes).
 * @param {string|null|undefined} trialInicio
 * @param {Date} [now]
 */
export function getDiasTrialRestantes(trialInicio, now = new Date()) {
  if (!trialInicio) return 14;
  const raw = String(trialInicio);
  const inicio =
    raw.includes('T') || raw.includes(' ')
      ? new Date(raw.replace(' ', 'T'))
      : new Date(raw + 'T00:00:00');
  if (isNaN(inicio.getTime())) return 14;
  const diff = Math.floor((now.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, 14 - diff);
}

export function isTrialAtivo(plano, trialInicio, now = new Date()) {
  if (plano !== 'trial') return false;
  return getDiasTrialRestantes(trialInicio, now) > 0;
}
