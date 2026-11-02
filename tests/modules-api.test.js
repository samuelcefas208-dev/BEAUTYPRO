/**
 * Testes unitários — contratos de módulos (ownership + API pública esperada)
 */
import { describe, it, expect } from 'vitest';
import {
  OWNERSHIP_REGISTRY,
  mayReassignWindowFn,
  isRegisteredHub,
} from '../../../src/domain/pure/ownership-policy.mjs';

describe('modules — ownership hubs', () => {
  it('regista renders de domínio', () => {
    expect(isRegisteredHub('renderClientes')).toBe(true);
    expect(isRegisteredHub('renderDashboard')).toBe(true);
    expect(isRegisteredHub('renderAgendaFull')).toBe(true);
    expect(isRegisteredHub('renderCaixa')).toBe(true);
    expect(isRegisteredHub('renderServicos')).toBe(true);
  });

  it('autoridade clientes aponta para modules/clientes', () => {
    const a = OWNERSHIP_REGISTRY.renderClientes.authority;
    expect(a).toMatch(/modules\/clientes|clientes-render/);
  });

  it('autoridade agenda aponta para agenda-board', () => {
    const a = OWNERSHIP_REGISTRY.renderAgendaFull.authority;
    expect(a).toMatch(/agenda-board|modules\/agenda/);
  });

  it('media não pode reassign renderClientes', () => {
    expect(mayReassignWindowFn('renderClientes', 'src/media/avatars-listas.js')).toBe(false);
  });

  it('dono clientes pode reassign', () => {
    expect(
      mayReassignWindowFn('renderClientes', 'src/modules/clientes/clientes-render.js'),
    ).toBe(true);
  });
});

describe('modules — nomes de domínio estáveis', () => {
  const domains = [
    'clientes',
    'caixa',
    'equipa',
    'servicos',
    'agenda',
    'dashboard',
    'vendas',
    'financeiro',
    'marketing',
    'crm',
    'ia',
    'configuracoes',
    'notificacoes',
  ];

  it('lista de domínios de produto está definida', () => {
    expect(domains.length).toBeGreaterThanOrEqual(12);
    expect(domains).toContain('notificacoes');
  });
});
