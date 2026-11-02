/* BelezaPro D-5.2 — core/supabase-resilience.js
 * Extraído de app.bundle.js (FILE: supabase-resilience.js).
 *
 * ORDEM: … → db-indexeddb → supabase-resilience → app.bundle.js → …
 *
 * Módulo IIFE: expõe bpFetchSupabase, bpRetryExponential, health monitor, etc. em window.
 * Não depende de state/IDB/Auth em runtime (getAuthHeaders só em comentário de uso).
 * Consumidores: sync-rest (bpFetchSupabase), sync-queue (health).
 *
 * Ver docs/D5_2_SUPABASE_RESILIENCE.md
 */

/**
 * supabase-resilience.js
 * Retry HTTP (backoff + jitter), timeout, latência e saúde do serviço Supabase.
 * Só transporte — sem regras de negócio.
 *
 * --- Exemplos de chamada ---
 *
 * // 1) Stats de latência (consola ou UI)
 * const s = bpGetSupabaseLatencyStats();
 * // → { n, avg, p95, fail, lastMs }
 *
 * // 2) Saúde agregada
 * const h = bpGetServiceHealth();
 * // → { level: 'ok'|'degraded'|'critical'|'unknown', label, stats, reasons: [] }
 *
 * // 3) Fetch manual com retry
 * const resp = await bpFetchSupabase(
 *   `${SUPABASE_URL}/rest/v1/movimentos?select=id`,
 *   { headers: await getAuthHeaders() },
 *   { label: 'movimentos-probe', retries: 2, timeoutMs: 10000 }
 * );
 *
 * // 4) Retry genérico em qualquer async
 * await bpRetryExponential(async () => {
 *   const r = await fetch(url, opts);
 *   if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
 *   return r.json();
 * }, { retries: 3, label: 'custom-job' });
 *
 * // 5) Arrancar monitor (já chamado uma vez no boot se main invocar bpStartHealthMonitor)
 * bpStartHealthMonitor({ intervalMs: 30000 });
 */
(function (global) {
  'use strict';

  var LAT_MAX = 48;

  /** Limiares de saúde (ms / rácios). Ajustáveis via bpConfigureHealthThresholds. */
  var THRESHOLDS = {
    warnAvgMs: 2500,
    warnP95Ms: 4000,
    critAvgMs: 5000,
    critP95Ms: 8000,
    warnFailRatio: 0.25,
    critFailRatio: 0.5,
    minSamples: 3
  };

  var _latencies = [];
  var _lastHealthLevel = 'unknown';
  var _monitorTimer = null;
  var _alertCooldownUntil = 0;

  function bpConfigureHealthThresholds(partial) {
    if (!partial || typeof partial !== 'object') return Object.assign({}, THRESHOLDS);
    Object.keys(partial).forEach(function (k) {
      if (THRESHOLDS[k] != null && typeof partial[k] === 'number') THRESHOLDS[k] = partial[k];
    });
    return Object.assign({}, THRESHOLDS);
  }

  function bpLogError(contexto, err, extra) {
    try {
      /* Offline: AuthRetryableFetchError (status 0) é esperado — não poluir consola */
      var _name = err && err.name ? String(err.name) : '';
      var _msg0 = err && err.message ? String(err.message) : '';
      if (
        (typeof navigator !== 'undefined' && navigator.onLine === false) &&
        (_name.indexOf('AuthRetryable') >= 0 || _msg0.indexOf('AuthRetryable') >= 0 ||
         _name.indexOf('FetchError') >= 0 || (err && err.status === 0))
      ) {
        try {
          if (!global.__bpAuthOfflineLogOnce) {
            global.__bpAuthOfflineLogOnce = 1;
            if (typeof console !== 'undefined' && console.debug) {
              console.debug('[BeautyPro] auth/rede offline (AuthRetryable suprimido neste modo)');
            }
          }
        } catch (_) {}
        return;
      }
      var msg = err && err.message ? err.message : String(err || 'erro');
      var payload = {
        ts: new Date().toISOString(),
        contexto: contexto || 'supabase',
        message: msg,
        status: err && err.status != null ? err.status : undefined,
        extra: extra || undefined
      };
      if (typeof console !== 'undefined' && console.error) {
        console.error('[BeautyPro]', payload.contexto, payload.message, payload);
      }
      global.__bpLastSupabaseError = payload;
    } catch (_) {}
  }

  function _recordLatency(ms, ok, meta) {
    try {
      _latencies.push({
        ms: Math.max(0, Math.round(ms)),
        ok: !!ok,
        t: Date.now(),
        meta: meta || null
      });
      if (_latencies.length > LAT_MAX) _latencies.shift();
    } catch (_) {}
  }

  function bpGetSupabaseLatencyStats() {
    if (!_latencies.length) {
      return { n: 0, avg: 0, p95: 0, fail: 0, lastMs: 0, failRatio: 0 };
    }
    var ms = _latencies.map(function (x) { return x.ms; }).sort(function (a, b) { return a - b; });
    var fail = _latencies.filter(function (x) { return !x.ok; }).length;
    var sum = ms.reduce(function (a, b) { return a + b; }, 0);
    var p95 = ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))];
    var last = _latencies[_latencies.length - 1];
    return {
      n: ms.length,
      avg: Math.round(sum / ms.length),
      p95: p95,
      fail: fail,
      lastMs: last ? last.ms : 0,
      failRatio: Math.round((fail / ms.length) * 100) / 100
    };
  }

  /**
   * Avalia saúde do serviço com base na janela de latência.
   * level: unknown | ok | degraded | critical
   */
  function bpGetServiceHealth() {
    var stats = bpGetSupabaseLatencyStats();
    var reasons = [];
    var level = 'unknown';

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        level: 'critical',
        label: 'Sem rede',
        stats: stats,
        reasons: ['navigator.offline']
      };
    }

    if (stats.n < THRESHOLDS.minSamples) {
      return {
        level: 'unknown',
        label: 'A calibrar',
        stats: stats,
        reasons: ['amostras_insuficientes']
      };
    }

    level = 'ok';
    if (stats.failRatio >= THRESHOLDS.critFailRatio) {
      level = 'critical';
      reasons.push('falhas_' + Math.round(stats.failRatio * 100) + '%');
    } else if (stats.failRatio >= THRESHOLDS.warnFailRatio) {
      level = 'degraded';
      reasons.push('falhas_' + Math.round(stats.failRatio * 100) + '%');
    }

    if (stats.p95 >= THRESHOLDS.critP95Ms || stats.avg >= THRESHOLDS.critAvgMs) {
      level = 'critical';
      reasons.push('latencia_p95_' + stats.p95 + 'ms');
    } else if (stats.p95 >= THRESHOLDS.warnP95Ms || stats.avg >= THRESHOLDS.warnAvgMs) {
      if (level !== 'critical') level = 'degraded';
      reasons.push('latencia_avg_' + stats.avg + 'ms');
    }

    var label =
      level === 'ok' ? 'Serviço OK' :
      level === 'degraded' ? 'Serviço lento' :
      level === 'critical' ? 'Serviço instável' : 'A calibrar';

    return { level: level, label: label, stats: stats, reasons: reasons };
  }

  /** Emite alerta suave só quando o nível piora (cooldown 60s). */
  function bpNotifyHealthIfNeeded(health) {
    if (!health || !health.level) return;
    var rank = { unknown: 0, ok: 1, degraded: 2, critical: 3 };
    var prev = rank[_lastHealthLevel] != null ? rank[_lastHealthLevel] : 0;
    var next = rank[health.level] != null ? rank[health.level] : 0;
    var worsened = next > prev && next >= 2;
    _lastHealthLevel = health.level;

    try {
      var container = document.getElementById('sync-status-container');
      if (container) {
        container.setAttribute('data-service-health', health.level);
        if (health.level === 'degraded' || health.level === 'critical') {
          container.classList.add('is-visible');
        }
      }
    } catch (_) {}

    // ET4.9b: sem avisos ao utilizador sobre «ligação ao servidor» / saúde do serviço.
    // A sincronização continua em silêncio; apenas log interno se necessário.
    if (!worsened) return;
    try {
      bpLogError('service-health', new Error(health.label || 'health'), {
        level: health.level,
        reasons: health.reasons,
        stats: health.stats
      });
    } catch (_) {}
  }

  function bpStartHealthMonitor(opts) {
    opts = opts || {};
    var intervalMs = opts.intervalMs != null ? opts.intervalMs : 30000;
    if (_monitorTimer) {
      try { clearInterval(_monitorTimer); } catch (_) {}
      _monitorTimer = null;
    }
    var tick = function () {
      try {
        var h = bpGetServiceHealth();
        bpNotifyHealthIfNeeded(h);
        global.__bpServiceHealth = h;
      } catch (_) {}
    };
    tick();
    _monitorTimer = setInterval(tick, intervalMs);
    return true;
  }

  function bpStopHealthMonitor() {
    if (_monitorTimer) {
      try { clearInterval(_monitorTimer); } catch (_) {}
      _monitorTimer = null;
    }
  }

  function _sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function _isRetryable(err) {
    if (!err) return false;
    if (err.name === 'AbortError' || err.name === 'TypeError') return true;
    var s = err.status;
    if (s === 429 || s === 408) return true;
    if (s >= 500 && s <= 599) return true;
    return false;
  }

  async function bpRetryExponential(fn, opts) {
    opts = opts || {};
    var retries = opts.retries != null ? opts.retries : 3;
    var baseMs = opts.baseMs != null ? opts.baseMs : 400;
    var maxMs = opts.maxMs != null ? opts.maxMs : 8000;
    var label = opts.label || 'bpRetry';
    var lastErr = null;
    for (var attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastErr = err;
        var retryable = _isRetryable(err);
        if (!retryable || attempt >= retries) {
          bpLogError(label, err, { attempt: attempt, retryable: retryable });
          throw err;
        }
        var delay = Math.min(maxMs, baseMs * Math.pow(2, attempt)) + Math.random() * 200;
        await _sleep(delay);
      }
    }
    throw lastErr;
  }

  async function bpFetchSupabase(url, options, meta) {
    meta = meta || {};
    options = options || {};
    var timeoutMs = meta.timeoutMs != null ? meta.timeoutMs : 12000;
    var retries = meta.retries != null ? meta.retries : 2;
    var label = meta.label || 'bpFetchSupabase';

    return bpRetryExponential(async function () {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = null;
      var started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      try {
        if (ctrl) {
          timer = setTimeout(function () {
            try { ctrl.abort(); } catch (_) {}
          }, timeoutMs);
        }
        var opts = {};
        for (var k in options) {
          if (Object.prototype.hasOwnProperty.call(options, k)) opts[k] = options[k];
        }
        if (ctrl) opts.signal = ctrl.signal;

        var resp = await fetch(url, opts);
        var ms = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - started);
        var softOk = resp.ok || (resp.status >= 400 && resp.status < 500 && resp.status !== 429);
        _recordLatency(ms, softOk, { label: label, status: resp.status });

        if (resp.status === 429 || (resp.status >= 500 && resp.status <= 599)) {
          var e = new Error('HTTP ' + resp.status);
          e.status = resp.status;
          e.response = resp;
          throw e;
        }
        return resp;
      } catch (err) {
        var ms2 = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - started);
        _recordLatency(ms2, false, { label: label, error: err && err.name });
        if (err && err.name === 'AbortError') {
          var te = new Error('Timeout Supabase (' + timeoutMs + 'ms)');
          te.status = 408;
          te.name = 'AbortError';
          throw te;
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }, { retries: retries, baseMs: 500, maxMs: 10000, label: label });
  }

  global.bpLogError = bpLogError;
  global.bpRetryExponential = bpRetryExponential;
  global.bpFetchSupabase = bpFetchSupabase;
  global.bpGetSupabaseLatencyStats = bpGetSupabaseLatencyStats;
  global.bpGetServiceHealth = bpGetServiceHealth;
  global.bpNotifyHealthIfNeeded = bpNotifyHealthIfNeeded;
  global.bpStartHealthMonitor = bpStartHealthMonitor;
  global.bpStopHealthMonitor = bpStopHealthMonitor;
  global.bpConfigureHealthThresholds = bpConfigureHealthThresholds;
})(typeof window !== 'undefined' ? window : globalThis);

