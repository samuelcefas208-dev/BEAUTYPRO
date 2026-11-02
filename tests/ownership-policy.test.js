/**
 * F3.1 — ownership mínimo
 */
import { describe, it, expect } from 'vitest';
import {
  OWNERSHIP_REGISTRY,
  isRegisteredHub,
  mayReassignWindowFn,
  hubsWithMultiOwnerRisk,
} from '../../../src/domain/pure/ownership-policy.mjs';

describe('F3.1 ownership-policy', () => {
  it('regista hubs críticos', () => {
    expect(isRegisteredHub('state')).toBe(true);
    expect(isRegisteredHub('dbPut')).toBe(true);
    expect(isRegisteredHub('syncQueue')).toBe(true);
    expect(isRegisteredHub('renderClientes')).toBe(true);
    expect(isRegisteredHub('salaoId')).toBe(true);
  });

  it('renderClientes só pode ser definido pelo módulo dono', () => {
    expect(
      mayReassignWindowFn('renderClientes', 'src/modules/clientes/clientes-render.js'),
    ).toBe(true);
    expect(mayReassignWindowFn('renderClientes', 'src/media/avatars-listas.js')).toBe(false);
  });

  it('lista riscos multi-dono', () => {
    const risks = hubsWithMultiOwnerRisk();
    expect(risks).toContain('renderClientes');
    expect(risks).toContain('state');
  });

  it('syncQueue authority é sync-queue.js', () => {
    expect(OWNERSHIP_REGISTRY.syncQueue.authority).toMatch(/sync-queue/);
  });
});
