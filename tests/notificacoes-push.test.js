/**
 * Testes unitários — notificações push (lógica sem DOM de produção)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pushSrc = readFileSync(
  join(__dirname, '../../../src/modules/notificacoes/push.js'),
  'utf8',
);

function loadPush(env) {
  const sandbox = { window: env, globalThis: env, console };
  vm.runInNewContext(pushSrc, sandbox);
  return env.BPNotify;
}

describe('notificacoes/push — BPNotify', () => {
  it('expõe API com owner modules/notificacoes', () => {
    const api = loadPush({
      Notification: { permission: 'default', requestPermission: () => Promise.resolve('default') },
      navigator: { serviceWorker: { ready: Promise.resolve({}) } },
      localStorage: { getItem: () => null, setItem: () => {} },
    });
    expect(api).toBeTruthy();
    expect(api._bpOwner).toBe('modules/notificacoes');
    expect(typeof api.requestPermission).toBe('function');
    expect(typeof api.showLocal).toBe('function');
    expect(typeof api.notifyExpiring).toBe('function');
  });

  it('supported() false sem Notification', () => {
    const api = loadPush({
      navigator: {},
      localStorage: { getItem: () => null, setItem: () => {} },
    });
    expect(api.supported()).toBe(false);
    expect(api.permission()).toBe('unsupported');
  });

  it('requestPermission grava preferência granted', async () => {
    const store2 = {};
    const api = loadPush({
      Notification: {
        permission: 'default',
        requestPermission: () => Promise.resolve('granted'),
      },
      navigator: { serviceWorker: {} },
      localStorage: {
        getItem: (k) => store2[k] || null,
        setItem: (k, v) => {
          store2[k] = v;
        },
      },
    });
    const r = await api.requestPermission();
    expect(r).toBe('granted');
    expect(store2.bp_push_pref).toBe('granted');
  });

  it('showLocal resolve false se permission denied', async () => {
    const api = loadPush({
      Notification: { permission: 'denied', requestPermission: () => Promise.resolve('denied') },
      navigator: {
        serviceWorker: {
          ready: Promise.resolve({ showNotification: () => Promise.resolve() }),
        },
      },
      localStorage: { getItem: () => null, setItem: () => {} },
    });
    const ok = await api.showLocal({ title: 't', body: 'b' });
    expect(ok).toBe(false);
  });
});
