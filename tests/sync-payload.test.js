import { describe, it, expect } from 'vitest';
import {
  slimPayload,
  shouldMoveToDlq,
  queuePressureLevel,
  MAX_SYNC_ATTEMPTS,
  QUEUE_SOFT_WARN,
  QUEUE_HARD_BLOCK,
} from '../domain/pure/sync-payload.mjs';

describe('slimPayload', () => {
  it('remove data URLs de strings', () => {
    const out = slimPayload({
      id: '1',
      nome: 'Ana',
      foto: 'data:image/png;base64,AAAA',
    });
    expect(out.id).toBe('1');
    expect(out.nome).toBe('Ana');
    expect(out.foto).toBeUndefined();
  });

  it('remove chaves foto/imagem aninhadas', () => {
    const out = slimPayload({
      id: '1',
      meta: { foto: 'data:x', ok: 1 },
    });
    expect(out.meta.ok).toBe(1);
    expect(out.meta.foto).toBeUndefined();
  });

  it('preserva payload escalar simples', () => {
    expect(slimPayload({ valor: 1500, tipo: 'venda' })).toEqual({
      valor: 1500,
      tipo: 'venda',
    });
  });

  it('null/primitivos passam', () => {
    expect(slimPayload(null)).toBe(null);
    expect(slimPayload(5)).toBe(5);
  });
});

describe('DLQ / pressão da fila', () => {
  it('MAX_SYNC_ATTEMPTS = 5', () => {
    expect(MAX_SYNC_ATTEMPTS).toBe(5);
    expect(shouldMoveToDlq(4)).toBe(false);
    expect(shouldMoveToDlq(5)).toBe(true);
  });

  it('níveis de pressão', () => {
    expect(queuePressureLevel(0)).toBe('ok');
    expect(queuePressureLevel(QUEUE_SOFT_WARN)).toBe('soft_warn');
    expect(queuePressureLevel(QUEUE_HARD_BLOCK)).toBe('hard_block');
  });
});
