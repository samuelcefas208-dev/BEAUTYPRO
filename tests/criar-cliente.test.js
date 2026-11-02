/**
 * F2-06 — use case decidirCriarCliente (puro).
 * NÃO prova addCliente / browser / IDB / sync.
 */
import { describe, it, expect } from 'vitest';
import {
  decidirCriarCliente,
  nomeClienteDuplicado,
} from '../domain/pure/criar-cliente.mjs';

function telOk(t) {
  return { ok: true, telefone: String(t).trim() };
}
function telFail() {
  return { ok: false, message: 'invalido' };
}

describe('F2-06 decidirCriarCliente', () => {
  const baseCtx = {
    plano: 'premium',
    clientes: [],
  };

  it('rejeita shape sem nome', () => {
    const r = decidirCriarCliente({ nome: '  ', telefone: '923456789' }, baseCtx);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('NOME_OBRIGATORIO');
  });

  it('rejeita shape sem telefone', () => {
    const r = decidirCriarCliente({ nome: 'Ana', telefone: '' }, baseCtx);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('TELEFONE_OBRIGATORIO');
  });

  it('rejeita limite de plano (trial, 30 activos)', () => {
    const clientes = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      nome: 'C' + i,
      ativo: true,
    }));
    const r = decidirCriarCliente(
      { nome: 'Nova', telefone: '923456789' },
      { plano: 'trial', clientes, validarTelefone: telOk },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LIMITE_PLANO');
  });

  it('soft-deleted não contam para limite', () => {
    const clientes = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      nome: 'C' + i,
      ativo: false,
    }));
    const r = decidirCriarCliente(
      { nome: 'Nova', telefone: '923456789' },
      { plano: 'trial', clientes, validarTelefone: telOk },
    );
    expect(r.ok).toBe(true);
  });

  it('rejeita telefone quando validarTelefone falha (T2)', () => {
    const r = decidirCriarCliente(
      { nome: 'Ana', telefone: '123' },
      { ...baseCtx, validarTelefone: telFail },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('TELEFONE_INVALIDO');
  });

  it('sem validarTelefone, salta formato e pode ok', () => {
    const r = decidirCriarCliente(
      { nome: 'Ana', telefone: 'qualquer' },
      { plano: 'premium', clientes: [] },
    );
    expect(r.ok).toBe(true);
    expect(r.command.payload.telefone).toBe('qualquer');
  });

  it('rejeita nome duplicado (case-insensitive)', () => {
    const r = decidirCriarCliente(
      { nome: '  ANA  ', telefone: '923456789' },
      {
        plano: 'premium',
        clientes: [{ id: '1', nome: 'ana' }],
        validarTelefone: telOk,
      },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('NOME_DUPLICADO');
  });

  it('ok: payload sem id nem salao_id', () => {
    const r = decidirCriarCliente(
      { nome: '  Ana  ', telefone: '923456789', pontos: 3, id: 'x', salao_id: 'y' },
      { ...baseCtx, validarTelefone: telOk },
    );
    expect(r.ok).toBe(true);
    expect(r.command.type).toBe('CREATE_CLIENTE');
    expect(r.command.payload.nome).toBe('Ana');
    expect(r.command.payload.telefone).toBe('923456789');
    expect(r.command.payload.pontos).toBe(3);
    expect(r.command.payload).not.toHaveProperty('id');
    expect(r.command.payload).not.toHaveProperty('salao_id');
  });

  it('nomeClienteDuplicado espelha trim+lower', () => {
    expect(nomeClienteDuplicado([{ nome: 'Bob' }], ' bob ')).toBe(true);
    expect(nomeClienteDuplicado([{ id: '1', nome: 'Bob' }], 'Bob', '1')).toBe(false);
  });
});
