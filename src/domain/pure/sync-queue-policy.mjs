/**
 * BELEZAPRO — política mínima da Sync Queue (caracterização F2-03).
 * NÃO é uma segunda implementação completa de sync-queue.js.
 * Espelha apenas decisões de enqueue + classificação de erro de flush
 * conforme leitura do código de produção.
 */

export const MAX_SYNC_ATTEMPTS = 5;
export const QUEUE_SOFT_WARN = 1000;
export const QUEUE_HARD_BLOCK = 5000;
export const BATCH_SIZE = 25;

/**
 * Shape de uma op nova (campos iniciais observados em addToSyncQueue).
 * @param {{ tabela: string, operacao: string, payload: object, id?: string, ts?: number }} partial
 */
export function buildQueueOperation(partial) {
  return {
    id: partial.id || 'op-test-id',
    tabela: partial.tabela,
    operacao: partial.operacao,
    payload: partial.payload,
    salaoId: partial.salaoId != null ? partial.salaoId : null,
    ts: partial.ts != null ? partial.ts : 0,
    attempts: 0,
    failed: false,
    nextRetry: 0,
    lastError: null,
    status: partial.status || 'pending',
  };
}

/**
 * Há delete pendente na fila para o mesmo entidade?
 * @param {Array<{ tabela?: string, operacao?: string, payload?: { id?: string } }>} queue
 * @param {string} tabela
 * @param {string|number} entityId
 */
export function queueHasPendingDelete(queue, tabela, entityId) {
  if (entityId == null) return false;
  return (queue || []).some(
    (item) =>
      item &&
      item.tabela === tabela &&
      item.operacao === 'delete' &&
      item.payload &&
      item.payload.id === entityId,
  );
}

/**
 * Remove ops com o mesmo tabela + payload.id (coalesce antes de push).
 * @param {Array} queue
 * @param {string} tabela
 * @param {string|number} entityId
 */
export function coalesceQueueByEntity(queue, tabela, entityId) {
  if (entityId == null) return (queue || []).slice();
  return (queue || []).filter(
    (item) =>
      !(item && item.tabela === tabela && item.payload && item.payload.id === entityId),
  );
}

/**
 * Decisão de enqueue — espelha a ordem de guards de addToSyncQueue (sem side-effects).
 *
 * @param {object} args
 * @param {string} args.tabela
 * @param {string} args.operacao
 * @param {{ id?: string }|null} args.payload
 * @param {Array} args.queue
 * @param {boolean} args.isTombstoned - isDeletedItem(id, tabela)
 * @returns {{ action: 'enqueue'|'reject', reason?: string, nextQueue?: Array, operation?: object }}
 */
export function decideEnqueue(args) {
  const { tabela, operacao, payload, queue, isTombstoned } = args;
  const entityId = payload && payload.id;
  let q = (queue || []).slice();

  if (operacao !== 'delete' && entityId != null && isTombstoned) {
    return { action: 'reject', reason: 'tombstone' };
  }

  if (entityId != null) {
    if (queueHasPendingDelete(q, tabela, entityId) && operacao !== 'delete') {
      return { action: 'reject', reason: 'delete_already_queued' };
    }
    q = coalesceQueueByEntity(q, tabela, entityId);
  }

  /* F2B.5: HARD_BLOCK já não rejeita enqueue — apenas pressiona (warn/flush). */
  const pressure = q.length >= QUEUE_HARD_BLOCK ? 'hard_block_warn' : null;

  const operation = buildQueueOperation({
    tabela,
    operacao,
    payload: payload || {},
    salaoId: args.salaoId != null ? args.salaoId : null,
    status: 'pending',
  });
  q.push(operation);
  return {
    action: 'enqueue',
    nextQueue: q,
    operation,
    pressure: pressure || (q.length >= QUEUE_SOFT_WARN ? 'soft_warn' : 'ok'),
  };
}

/**
 * Classifica o próximo passo após erro no flush (catch), sem mutar a op.
 * Preserva caminhos especiais observados no código.
 *
 * @param {string} errorMessage
 * @param {number} currentAttempts - attempts ANTES do incremento deste erro
 * @returns {{ outcome: string, attemptsAfter: number, goesToDlq: boolean, staysInQueue: boolean }}
 */
export function classifyFlushError(errorMessage, currentAttempts) {
  const msg = String(errorMessage || '');
  const attemptsAfter = (currentAttempts || 0) + 1;

  if (msg === 'SESSION_EXPIRED') {
    return {
      outcome: 'session_expired_interrupt',
      attemptsAfter: currentAttempts || 0, // código NÃO incrementa attempts neste ramo antes do break
      goesToDlq: false,
      staysInQueue: true,
      note: 'attempts not incremented in SESSION_EXPIRED branch before interrupt',
    };
  }

  if (msg === 'LIMITE_PLANO_ATINGIDO') {
    return {
      outcome: 'backoff_plan_limit',
      attemptsAfter,
      goesToDlq: false,
      staysInQueue: true,
    };
  }

  if (msg === 'DUPLICADO_BLOQUEADO' || msg.indexOf('DUPLICADO') >= 0) {
    return {
      outcome: 'requires_attention',
      failureClass: 'requires_attention',
      attemptsAfter: currentAttempts || 0,
      goesToDlq: true,
      staysInQueue: false,
      note: 'F2B.3: DLQ = requires_attention, não abandono por rede',
    };
  }

  if (String(msg).indexOf('PAYLOAD_DEGRADED') >= 0) {
    return {
      outcome: 'requires_attention',
      failureClass: 'requires_attention',
      attemptsAfter: currentAttempts || 0,
      goesToDlq: true,
      staysInQueue: false,
    };
  }

  /* F2B.3: falha genérica/transitória — NUNCA DLQ só por MAX_ATTEMPTS */
  const failureClass = classifyFailureClass(msg);
  if (failureClass === 'requires_attention') {
    return {
      outcome: 'requires_attention',
      failureClass,
      attemptsAfter,
      goesToDlq: true,
      staysInQueue: false,
    };
  }

  return {
    outcome: attemptsAfter >= MAX_SYNC_ATTEMPTS ? 'retry_scheduled_long_backoff' : 'backoff_retry',
    failureClass: 'transient',
    attemptsAfter,
    goesToDlq: false,
    staysInQueue: true,
    note: 'F2B.3: attempts controlam backoff, não abandono',
  };
}

/**
 * Espelho simplificado de classifySyncFailure (produção F2B.3).
 * @param {string} msg
 * @returns {'transient'|'requires_attention'}
 */
export function classifyFailureClass(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.indexOf('payload_degraded') >= 0) return 'requires_attention';
  if (m.indexOf('duplicado') >= 0) return 'requires_attention';
  if (m.indexOf('tenant') >= 0) return 'requires_attention';
  return 'transient';
}

/**
 * Espelho de isPayloadDegraded (F2B.1).
 * @param {{ operacao?: string, payload?: object, payloadDegraded?: boolean }} op
 */
export function isPayloadDegraded(op) {
  if (!op) return true;
  if (op.payloadDegraded === true) return true;
  const p = op.payload;
  if (p == null || typeof p !== 'object') return true;
  if (op.operacao === 'delete') {
    return p.id == null || p.id === '';
  }
  const keys = Object.keys(p).filter(function (k) {
    return p[k] !== undefined && p[k] !== null;
  });
  if (keys.length === 0) return true;
  if (keys.length === 1 && keys[0] === 'id') return true;
  if (keys.length === 2 && keys.indexOf('id') >= 0 && keys.indexOf('updated_at') >= 0) {
    return true;
  }
  return false;
}

/**
 * Reprocess DLQ: só mesmo tenant (F1).
 * @param {{ salaoId?: string|null }} item
 * @param {string|null|undefined} sessionSalaoId
 */
export function canReprocessDlqItem(item, sessionSalaoId) {
  if (!item) return false;
  const itemSid = item.salaoId != null ? String(item.salaoId).trim() : '';
  if (!itemSid) return false;
  const session = sessionSalaoId != null ? String(sessionSalaoId).trim() : '';
  if (!session) return false;
  return itemSid === session;
}

/**
 * F2B.3: saveDlq não usa slice destrutivo.
 * @returns {boolean}
 */
export function isDlqSilentSliceForbidden() {
  return true;
}

/**
 * Pressão da fila (só limiares).
 * @param {number} length
 */
export function queuePressure(length) {
  if (length >= QUEUE_HARD_BLOCK) return 'hard_block';
  if (length >= QUEUE_SOFT_WARN) return 'soft_warn';
  return 'ok';
}
