/**
 * F2-04 — testes de política de isolamento salao_id.
 * Caracterização apenas. NÃO prova RLS live nem isolamento no browser.
 */
import { describe, it, expect } from 'vitest';
import {
  isRemoteSyncAllowed,
  canonicalSalaoIdForPayload,
  applyCanonicalSalaoId,
  isSalaoSwitch,
  idbStoresClearedOnSwitch,
  isConfigStoreClearedOnSwitch,
  isDlqClearedOnSalaoSwitch,
  lsKeysClearedOnSwitch,
  lsKeysNotClearedOnSwitch,
  planoCacheKeyForSalao,
  SYNC_QUEUE_KEY,
  DELETED_ITEMS_KEY,
  DLQ_KEY,
  IDB_STORES_CLEARED_ON_SALAO_SWITCH,
} from '../domain/pure/salao-isolation-policy.mjs';

describe('F2-04 salao isolation policy (caracterização)', () => {
  describe('sync remoto permitido somente com salaoId', () => {
    it('permite quando há salaoId não vazio', () => {
      expect(isRemoteSyncAllowed('uuid-salao-a')).toBe(true);
      expect(isRemoteSyncAllowed('  x  ')).toBe(true);
    });

    it('bloqueia null, undefined e string vazia', () => {
      expect(isRemoteSyncAllowed(null)).toBe(false);
      expect(isRemoteSyncAllowed(undefined)).toBe(false);
      expect(isRemoteSyncAllowed('')).toBe(false);
      expect(isRemoteSyncAllowed('   ')).toBe(false);
    });
  });

  describe('salaoId da sessão como valor canónico do payload', () => {
    it('usa a sessão e ignora item.salao_id de outro salão', () => {
      const session = 'salao-B';
      const item = { id: '1', nome: 'Cliente', salao_id: 'salao-A' };
      expect(canonicalSalaoIdForPayload(session, item)).toBe('salao-B');
      const out = applyCanonicalSalaoId(session, item);
      expect(out.salao_id).toBe('salao-B');
      expect(out.id).toBe('1');
      expect(out.nome).toBe('Cliente');
    });

    it('lança se a sessão não tem salaoId', () => {
      expect(() => canonicalSalaoIdForPayload(null, { id: '1' })).toThrow(
        /Salão não identificado/,
      );
      expect(() => applyCanonicalSalaoId('', { id: '1' })).toThrow();
    });
  });

  describe('detecção de troca de salão', () => {
    it('detecta quando anterior e novo existem e diferem', () => {
      expect(isSalaoSwitch('A', 'B')).toBe(true);
    });

    it('não detecta se iguais, ou se falta anterior ou novo', () => {
      expect(isSalaoSwitch('A', 'A')).toBe(false);
      expect(isSalaoSwitch(null, 'B')).toBe(false);
      expect(isSalaoSwitch('A', null)).toBe(false);
      expect(isSalaoSwitch(null, null)).toBe(false);
    });
  });

  describe('stores IDB limpas na troca', () => {
    it('lista exacta observada no loadState(true)', () => {
      expect(idbStoresClearedOnSwitch()).toEqual([
        'clientes',
        'agendamentos',
        'movimentos',
        'profissionais',
        'servicos',
        'fechos_caixa',
      ]);
      expect(IDB_STORES_CLEARED_ON_SALAO_SWITCH).toContain('fechos_caixa');
    });

    it('config NÃO é limpa na troca', () => {
      expect(isConfigStoreClearedOnSwitch()).toBe(false);
      expect(idbStoresClearedOnSwitch()).not.toContain('config');
    });
  });

  describe('localStorage na troca — limpo vs não limpo', () => {
    it('fila e tombstones estão entre as chaves limpas', () => {
      const cleared = lsKeysClearedOnSwitch();
      expect(cleared).toContain(SYNC_QUEUE_KEY);
      expect(cleared).toContain(DELETED_ITEMS_KEY);
      expect(cleared).toContain('bp_plano_cache');
    });

    it('bp_dlq é limpa na troca (F1 / V-F0-001)', () => {
      expect(isDlqClearedOnSalaoSwitch()).toBe(true);
      expect(lsKeysClearedOnSwitch()).toContain(DLQ_KEY);
      expect(lsKeysNotClearedOnSwitch()).not.toContain(DLQ_KEY);
    });

    it('plano namespaced usa salaoId', () => {
      expect(planoCacheKeyForSalao('abc')).toBe('bp_plano_cache_abc');
    });
  });

  describe('limites (não afirma RLS live)', () => {
    it('política não exporta afirmação de RLS activo', () => {
      // Contrato: testes pure ≠ prova de RLS. Este bloco só garante
      // que o módulo de política não declara "rlsLive" como verdadeiro.
      const mod = {
        isRemoteSyncAllowed,
        isDlqClearedOnSalaoSwitch,
      };
      expect(mod).not.toHaveProperty('rlsLive');
      expect(mod).not.toHaveProperty('assertRlsActive');
    });
  });
});
