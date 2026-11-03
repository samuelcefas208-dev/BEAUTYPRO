/* BelezaPro D-1 — core/constants.js
 * Extraído de app.bundle.js (FILE: core-constants.js).
 *
 * IMPORTANTE (browser, scripts clássicos):
 *   `const`/`let` NÃO ficam visíveis noutros <script>.
 *   Por isso usamos `var` + espelho em window.* para o resto do CORE/UI.
 * Carregar ANTES de app.bundle.js.
 */
(function (g) {
  'use strict';

  var SUPABASE_URL = 'https://xbudnftutemakjbgxayf.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhidWRuZnR1dGVtYWtqYmd4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDI1OTMsImV4cCI6MjA5ODMxODU5M30.wJekXdH7z9qcIoF4WsvWST8ro9VsskLGQgcivNx6fYo';

  var WHATSAPP_NUMBER = '953980750';
  var IA_EDGE_URL = SUPABASE_URL + '/functions/v1/ia-query';
  var PROVISION_EDGE_URL = SUPABASE_URL + '/functions/v1/provision-empresa';
  var INVITE_MEMBRO_EDGE_URL = SUPABASE_URL + '/functions/v1/invite-membro';
  var SET_BLOQUEIO_EDGE_URL = SUPABASE_URL + '/functions/v1/set-membro-bloqueio';
  /** Domínio da app em produção (recovery + OAuth redirect). */
  var BP_AUTH_SITE_URL = 'https://tatilson.vercel.app';

  var STORE_TO_TABLE = {
    clientes: 'clientes',
    agendamentos: 'agendamentos',
    movimentos: 'movimentos',
    profissionais: 'profissionais',
    servicos: 'servicos',
    fechos_caixa: 'fechos_caixa',
    config: null
  };

  var SYNC_QUEUE_KEY = 'bp_sync_queue';

  var PLANOS = {
    trial: { label: 'Plano Gratuito', badgeClass: 'plano-trial', agendamentos: 60, clientes: 30, profissionais: 1, iaDia: 0 },
    starter: { label: 'Starter', badgeClass: 'plano-starter', agendamentos: 200, clientes: 150, profissionais: 2, iaDia: 0 },
    pro: { label: 'Pro', badgeClass: 'plano-pro', agendamentos: Infinity, clientes: Infinity, profissionais: 8, iaDia: 5 },
    premium: { label: 'Premium', badgeClass: 'plano-premium', agendamentos: Infinity, clientes: Infinity, profissionais: Infinity, iaDia: Infinity }
  };

  var PROF_DEFAULT = [
    { id: '34787d59-2187-4953-978c-16cd85813f22', nome: 'Ana', especialidade: 'Coloração' },
    { id: '33ea5d65-c6ba-4be0-a5e0-037052eb1950', nome: 'Carlos', especialidade: 'Corte' },
    { id: '61ec734c-1177-465a-8613-437c4ad5c9b2', nome: 'Marta', especialidade: 'Manicure / Pedicure' }
  ];

  var SERVICOS_DEFAULT = [
    { id: '5334ca54-26e8-43ce-a606-59a424522517', nome: 'Corte de Cabelo', precoBase: 3000, profissionais: ['Ana', 'Carlos'] },
    { id: '1c07da53-9b30-4e6e-b007-b2bc654183ce', nome: 'Coloração', precoBase: 8000, profissionais: ['Ana'] },
    { id: '10497abb-032a-491f-ad1c-ae3d654b37b1', nome: 'Manicure', precoBase: 2000, profissionais: ['Marta'] },
    { id: '4aea339f-bc33-4cfa-8fa8-2243de16b4c3', nome: 'Pedicure', precoBase: 2500, profissionais: ['Marta'] },
    { id: 'a831b14c-f915-46e0-b7a6-f6eea4d8e2bc', nome: 'Maquilhagem', precoBase: 5000, profissionais: ['Ana'] },
    { id: '700ca860-bcf9-4b33-823d-15b92ef132f0', nome: 'Barba', precoBase: 1500, profissionais: ['Carlos'] },
    { id: '7547642b-eeaf-4110-b046-da80b30bf0ba', nome: 'Penteado', precoBase: 4000, profissionais: ['Ana', 'Marta'] },
    { id: '1a81fd9a-8778-44a5-bd3e-11b3a261e1ce', nome: 'Tratamento Capilar', precoBase: 6000, profissionais: ['Ana', 'Carlos'] }
  ];

  var RBAC_ROLES = ['admin', 'gerente', 'operador'];

  var BP_METODOS_PAGAMENTO = [
    { value: 'Numerário', label: 'Numerário' },
    { value: 'Multicaixa Express', label: 'Multicaixa Express' },
    { value: 'Transferência', label: 'Transferência' },
    { value: 'Cartão', label: 'Cartão' },
    { value: '__split__', label: 'Split' }
  ];

  // Espelho global (scripts clássicos seguintes)
  g.SUPABASE_URL = SUPABASE_URL;
  g.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  g.WHATSAPP_NUMBER = WHATSAPP_NUMBER;
  g.IA_EDGE_URL = IA_EDGE_URL;
  g.PROVISION_EDGE_URL = PROVISION_EDGE_URL;
  g.INVITE_MEMBRO_EDGE_URL = INVITE_MEMBRO_EDGE_URL;
  g.SET_BLOQUEIO_EDGE_URL = SET_BLOQUEIO_EDGE_URL;
  g.BP_AUTH_SITE_URL = BP_AUTH_SITE_URL;
  g.STORE_TO_TABLE = STORE_TO_TABLE;
  g.SYNC_QUEUE_KEY = SYNC_QUEUE_KEY;
  g.PLANOS = PLANOS;
  g.PROF_DEFAULT = PROF_DEFAULT;
  g.SERVICOS_DEFAULT = SERVICOS_DEFAULT;
  g.RBAC_ROLES = RBAC_ROLES;
  g.BP_METODOS_PAGAMENTO = BP_METODOS_PAGAMENTO;
})(typeof window !== 'undefined' ? window : this);
