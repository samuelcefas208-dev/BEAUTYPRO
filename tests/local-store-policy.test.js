import { describe, it, expect } from 'vitest';
import {
  IDB_STORES,
  IDB_NAME,
  IDB_VERSION,
  MEM_TTL_MS,
  MIRROR_QUOTA_FALLBACK_MAX_ITEMS,
  DLQ_PERSIST_MAX_ITEMS,
  SYNC_QUEUE_KEY,
  DLQ_KEY,
  DELETED_ITEMS_KEY,
  mirrorKeyForStore,
  domainDataSourceOfTruth,
  mirrorRole,
  syncLocalStorageRole,
  mirrorPayloadAfterQuotaFailure,
  readPreferenceOrder,
} from '../domain/pure/local-store-policy.mjs';

describe('contrato IndexedDB (constantes = código actual)', () => {
  it('nome e versão da base', () => {
    expect(IDB_NAME).toBe('BelezaProDB');
    expect(IDB_VERSION).toBe(8);
  });

  it('STORES inclui fechos_caixa e as 7 stores', () => {
    expect(IDB_STORES).toEqual([
      'config',
      'clientes',
      'agendamentos',
      'movimentos',
      'profissionais',
      'servicos',
      'fechos_caixa',
    ]);
  });

  it('TTL memória = 800ms', () => {
    expect(MEM_TTL_MS).toBe(800);
  });
});

describe('espelho e papéis', () => {
  it('chave mirror bp_${store}', () => {
    expect(mirrorKeyForStore('clientes')).toBe('bp_clientes');
    expect(mirrorKeyForStore('fechos_caixa')).toBe('bp_fechos_caixa');
  });

  it('fonte de verdade de domínio = indexeddb', () => {
    expect(domainDataSourceOfTruth()).toBe('indexeddb');
  });

  it('mirror = recovery_mirror, não source of truth', () => {
    expect(mirrorRole()).toBe('recovery_mirror');
  });

  it('fila/DLQ = sync_infrastructure', () => {
    expect(syncLocalStorageRole()).toBe('sync_infrastructure');
    expect(SYNC_QUEUE_KEY).toBe('bp_sync_queue');
    expect(DLQ_KEY).toBe('bp_dlq');
    expect(DELETED_ITEMS_KEY).toBe('bp_deleted_items');
  });
});

describe('truncagem de mirror só após falha de quota', () => {
  it('escrita normal devolve array completo', () => {
    const items = Array.from({ length: 250 }, (_, i) => ({ id: i }));
    expect(mirrorPayloadAfterQuotaFailure(items, false)).toHaveLength(250);
  });

  it('após falha e length > 200, devolve últimos 200', () => {
    const items = Array.from({ length: 250 }, (_, i) => ({ id: i }));
    const out = mirrorPayloadAfterQuotaFailure(items, true);
    expect(out).toHaveLength(200);
    expect(out[0].id).toBe(50);
    expect(out[199].id).toBe(249);
  });

  it('após falha e length ≤ 200, null (não grava fallback truncado)', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    expect(mirrorPayloadAfterQuotaFailure(items, true)).toBeNull();
  });

  it('constante de truncagem = 200 (igual DLQ persist max no código actual)', () => {
    expect(MIRROR_QUOTA_FALLBACK_MAX_ITEMS).toBe(200);
    expect(DLQ_PERSIST_MAX_ITEMS).toBe(200);
  });
});

describe('ordem de leitura conceptual', () => {
  it('memória → IDB → mirror LS', () => {
    expect(readPreferenceOrder()).toEqual([
      'memory_cache',
      'indexeddb',
      'localstorage_mirror',
    ]);
  });
});
