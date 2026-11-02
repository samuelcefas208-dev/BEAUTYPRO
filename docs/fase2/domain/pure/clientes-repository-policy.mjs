/**
 * BELEZAPRO — política do repository de clientes (puro).
 * Caracteriza o comportamento documentado de addCliente / updateCliente / deleteCliente.
 * NÃO altera o runtime. F2-05 Opção A.
 * NÃO é uma segunda implementação das regras de negócio.
 */

/** Campos mínimos exigidos pelo create (antes de outras validações de formato). */
export const CLIENTE_CREATE_REQUIRED_FIELDS = Object.freeze(['nome', 'telefone']);

/**
 * Modo de eliminação no fluxo principal de clientes.
 * Observado: hard delete via _deleteComRollback (não soft-delete como serviços).
 */
export const CLIENTE_DELETE_MODE = 'hard';

/**
 * Roles que o código exige para deleteCliente (bpExigirRole).
 */
export const CLIENTE_DELETE_ROLES = Object.freeze(['admin', 'gerente']);

/**
 * Cliente considerado activo em listagens (mesmo critério Benza / filtros).
 * @param {object|null|undefined} c
 * @returns {boolean}
 */
export function isClienteActive(c) {
  if (!c || typeof c !== 'object') return false;
  return c.ativo !== false && c.ativo !== 0 && c.ativo !== 'false';
}

/**
 * Filtra lista para activos.
 * @param {Array} list
 * @returns {Array}
 */
export function filterClientesActive(list) {
  return (list || []).filter(isClienteActive);
}

/**
 * Shape mínimo de input para create (política).
 * Não valida formato de telefone (isso fica no CRUD / bpValidarTelefoneCliente).
 * @param {object} input
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateClienteCreateShape(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, reason: 'INPUT_INVALIDO' };
  }
  const nome = input.nome != null ? String(input.nome).trim() : '';
  if (!nome) {
    return { ok: false, reason: 'NOME_OBRIGATORIO' };
  }
  const telefone = input.telefone != null ? String(input.telefone).trim() : '';
  if (!telefone) {
    return { ok: false, reason: 'TELEFONE_OBRIGATORIO' };
  }
  return { ok: true };
}

/**
 * Create local não deve exigir nem definir salao_id (vem da sessão no sync).
 * @param {object} input
 * @returns {boolean}
 */
export function createInputShouldOmitSalaoIdRequirement(input) {
  void input;
  return true;
}

/**
 * Resultado null do addCliente significa rejeição ou limite (não sucesso).
 * @param {unknown} result
 * @returns {boolean}
 */
export function isCreateRejected(result) {
  return result == null;
}

/**
 * Resultado false do deleteCliente significa sem permissão ou não encontrado / falha tratada.
 * @param {unknown} result
 * @returns {boolean}
 */
export function isDeleteRejected(result) {
  return result === false;
}

/**
 * Delete mode documentado para clientes.
 * @returns {'hard'}
 */
export function getClienteDeleteMode() {
  return CLIENTE_DELETE_MODE;
}

/**
 * Side-effect de update com rename: propaga para movimentos e agendamentos.
 * Documentado para qualquer fachada futura não contornar updateCliente.
 * @returns {ReadonlyArray<string>}
 */
export function storesAffectedByClienteRename() {
  return Object.freeze(['movimentos', 'agendamentos']);
}

/**
 * API conceptual da fachada (nomes estáveis para testes de contrato).
 * @returns {ReadonlyArray<string>}
 */
export function repositoryMethodNames() {
  return Object.freeze([
    'listAll',
    'listActive',
    'getById',
    'create',
    'update',
    'remove',
  ]);
}
