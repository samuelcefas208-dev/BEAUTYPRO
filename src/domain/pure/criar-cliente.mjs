/**
 * BELEZAPRO — use case puro: decidir criação de cliente (F2-06).
 * NÃO substitui addCliente. NÃO persiste. NÃO toca no runtime.
 * Telefone: só via ctx.validarTelefone (T2 injectável).
 */

import { canCreateWithinPlan, countActive } from './planos.mjs';
import { validateClienteCreateShape } from './clientes-repository-policy.mjs';

/**
 * Duplicado de nome — espelho de existeNomeDuplicado (trim + toLowerCase).
 * @param {Array<{ id?: string, nome?: string }>} clientes
 * @param {string} nome
 * @param {string|null} [idIgnorar]
 * @returns {boolean}
 */
export function nomeClienteDuplicado(clientes, nome, idIgnorar = null) {
  const nomeNormalizado = (nome || '').trim().toLowerCase();
  if (!nomeNormalizado) return false;
  const lista = Array.isArray(clientes) ? clientes : [];
  return lista.some(function (item) {
    if (!item || !item.nome) return false;
    if (idIgnorar && item.id === idIgnorar) return false;
    return String(item.nome).trim().toLowerCase() === nomeNormalizado;
  });
}

/**
 * Decide se a criação de cliente é válida (sem efeitos laterais).
 *
 * @param {object} input — { nome, telefone, ... }
 * @param {object} ctx — { plano, clientes, validarTelefone? }
 * @returns {{ ok: true, command: object } | { ok: false, reason: string }}
 */
export function decidirCriarCliente(input, ctx) {
  const context = ctx && typeof ctx === 'object' ? ctx : {};
  const clientes = Array.isArray(context.clientes) ? context.clientes : [];
  const plano = context.plano != null ? String(context.plano) : 'trial';

  const shape = validateClienteCreateShape(input);
  if (!shape.ok) {
    return { ok: false, reason: shape.reason || 'INPUT_INVALIDO' };
  }

  const totals = { clientes: countActive(clientes) };
  if (!canCreateWithinPlan('clientes', totals, plano)) {
    return { ok: false, reason: 'LIMITE_PLANO' };
  }

  const nome = String(input.nome).trim();
  let telefone = String(input.telefone).trim();

  if (typeof context.validarTelefone === 'function') {
    const tel = context.validarTelefone(telefone);
    if (!tel || !tel.ok) {
      return { ok: false, reason: 'TELEFONE_INVALIDO' };
    }
    if (tel.telefone != null && String(tel.telefone).trim() !== '') {
      telefone = String(tel.telefone).trim();
    }
  }

  if (nomeClienteDuplicado(clientes, nome, null)) {
    return { ok: false, reason: 'NOME_DUPLICADO' };
  }

  const payload = { nome: nome, telefone: telefone };
  if (input && typeof input === 'object') {
    Object.keys(input).forEach(function (k) {
      if (k === 'nome' || k === 'telefone' || k === 'id' || k === 'salao_id') return;
      payload[k] = input[k];
    });
  }

  return {
    ok: true,
    command: {
      type: 'CREATE_CLIENTE',
      payload: payload,
    },
  };
}
