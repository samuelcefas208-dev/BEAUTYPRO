/**
 * F3.1 — testes de política da Sync Queue (alinhados a F1 + F2B.1 + F2B.3 + F2B.5).
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_SYNC_ATTEMPTS,
  QUEUE_HARD_BLOCK,
  buildQueueOperation,
  queueHasPendingDelete,
  coalesceQueueByEntity,
  decideEnqueue,
  classifyFlushError,
  isPayloadDegraded,
  canReprocessDlqItem,
  isDlqSilentSliceForbidden,
  queuePressure,
} from '../domain/pure/sync-queue-policy.mjs';

describe('F3.1 sync-queue-policy (pos F2B)', () => {
  describe('enqueue + hard_block F2B.5', () => {
    it('enfileira op normal com status pending e salaoId', () => {
      const r = decideEnqueue({
        tabela: 'clientes',
        operacao: 'upsert',
        payload: { id: 'c1', nome: 'Ana' },
        queue: [],
        isTombstoned: false,
        salaoId: 'salao-A',
      });
      expect(r.action).toBe('enqueue');
      expect(r.operation.status).toBe('pending');
      expect(r.operation.salaoId).toBe('salao-A');
      expect(r.nextQueue).toHaveLength(1);
    });

    it('HARD_BLOCK ja nao rejeita — enfileira com pressure hard_block_warn', () => {
      const big = Array.from({ length: QUEUE_HARD_BLOCK }, (_, i) =>
        buildQueueOperation({
          id: 'op-' + i,
          tabela: 'clientes',
          operacao: 'upsert',
          payload: { id: 'e' + i },
        }),
      );
      const r = decideEnqueue({
        tabela: 'clientes',
        operacao: 'upsert',
        payload: { id: 'new', nome: 'X' },
        queue: big,
        isTombstoned: false,
        salaoId: 's1',
      });
      expect(r.action).toBe('enqueue');
      expect(r.pressure).toBe('hard_block_warn');
      expect(r.nextQueue.length).toBe(QUEUE_HARD_BLOCK + 1);
    });

    it('rejeita upsert se tombstone activo', () => {
      const r = decideEnqueue({
        tabela: 'clientes',
        operacao: 'upsert',
        payload: { id: 'c1' },
        queue: [],
        isTombstoned: true,
      });
      expect(r.action).toBe('reject');
      expect(r.reason).toBe('tombstone');
    });

    it('coalesce por entidade', () => {
      const q = [
        buildQueueOperation({
          id: 'a',
          tabela: 'clientes',
          operacao: 'upsert',
          payload: { id: 'c1', nome: 'Old' },
        }),
      ];
      const next = coalesceQueueByEntity(q, 'clientes', 'c1');
      expect(next).toHaveLength(0);
    });
  });

  describe('classifyFlushError F2B.3 (attempts != abandono)', () => {
    it('SESSION_EXPIRED nao vai a DLQ', () => {
      const r = classifyFlushError('SESSION_EXPIRED', 2);
      expect(r.goesToDlq).toBe(false);
      expect(r.staysInQueue).toBe(true);
    });

    it('DUPLICADO -> requires_attention + DLQ', () => {
      const r = classifyFlushError('DUPLICADO_BLOQUEADO', 0);
      expect(r.outcome).toBe('requires_attention');
      expect(r.goesToDlq).toBe(true);
    });

    it('network com attempts >= MAX NAO abandona — fica na fila', () => {
      const r = classifyFlushError('network', MAX_SYNC_ATTEMPTS);
      expect(r.goesToDlq).toBe(false);
      expect(r.staysInQueue).toBe(true);
      expect(r.failureClass).toBe('transient');
      expect(r.outcome).toBe('retry_scheduled_long_backoff');
    });

    it('timeout com attempts 0 -> backoff_retry', () => {
      const r = classifyFlushError('timeout', 0);
      expect(r.outcome).toBe('backoff_retry');
      expect(r.goesToDlq).toBe(false);
    });

    it('PAYLOAD_DEGRADED -> requires_attention', () => {
      const r = classifyFlushError('PAYLOAD_DEGRADED_NO_RECOVERY', 1);
      expect(r.goesToDlq).toBe(true);
      expect(r.failureClass).toBe('requires_attention');
    });
  });

  describe('payload degradado F2B.1', () => {
    it('DELETE so com id NAO esta degradado', () => {
      expect(isPayloadDegraded({ operacao: 'delete', payload: { id: 'x' } })).toBe(false);
    });

    it('UPSERT so com id ESTA degradado', () => {
      expect(isPayloadDegraded({ operacao: 'upsert', payload: { id: 'x' } })).toBe(true);
    });

    it('UPSERT completo nao esta degradado', () => {
      expect(
        isPayloadDegraded({
          operacao: 'upsert',
          payload: { id: 'x', nome: 'Ana', telefone: '1' },
        }),
      ).toBe(false);
    });

    it('flag payloadDegraded forca true', () => {
      expect(
        isPayloadDegraded({
          operacao: 'upsert',
          payload: { id: 'x', nome: 'A' },
          payloadDegraded: true,
        }),
      ).toBe(true);
    });
  });

  describe('DLQ reprocess F1', () => {
    it('mesmo tenant -> permitido', () => {
      expect(canReprocessDlqItem({ salaoId: 'A' }, 'A')).toBe(true);
    });

    it('tenant diferente -> bloqueado', () => {
      expect(canReprocessDlqItem({ salaoId: 'A' }, 'B')).toBe(false);
    });

    it('legado sem salaoId -> bloqueado', () => {
      expect(canReprocessDlqItem({ salaoId: null }, 'A')).toBe(false);
    });
  });

  describe('no silent slice', () => {
    it('slice destrutivo da DLQ e proibido pelo contrato', () => {
      expect(isDlqSilentSliceForbidden()).toBe(true);
    });
  });

  describe('queuePressure', () => {
    it('reflecte limiares', () => {
      expect(queuePressure(0)).toBe('ok');
      expect(queuePressure(1000)).toBe('soft_warn');
      expect(queuePressure(5000)).toBe('hard_block');
    });
  });

  describe('helpers', () => {
    it('queueHasPendingDelete', () => {
      const q = [
        buildQueueOperation({
          tabela: 'clientes',
          operacao: 'delete',
          payload: { id: 'c1' },
        }),
      ];
      expect(queueHasPendingDelete(q, 'clientes', 'c1')).toBe(true);
      expect(queueHasPendingDelete(q, 'clientes', 'c2')).toBe(false);
    });
  });
});
