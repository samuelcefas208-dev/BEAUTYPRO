import { describe, it, expect } from 'vitest';
import {
  PLANOS,
  getLimites,
  isEntityActive,
  countActive,
  canCreateWithinPlan,
  getDiasTrialRestantes,
  isTrialAtivo,
} from '../domain/pure/planos.mjs';

describe('PLANOS (espelho core-constants)', () => {
  it('trial limita clientes a 30 e profissionais a 1', () => {
    expect(PLANOS.trial.clientes).toBe(30);
    expect(PLANOS.trial.profissionais).toBe(1);
    expect(PLANOS.trial.agendamentos).toBe(60);
    expect(PLANOS.trial.iaDia).toBe(0);
  });

  it('premium não limita recursos e iaDia infinito', () => {
    expect(PLANOS.premium.clientes).toBe(Infinity);
    expect(PLANOS.premium.profissionais).toBe(Infinity);
    expect(PLANOS.premium.iaDia).toBe(Infinity);
  });

  it('pro limita profissionais a 8 e iaDia a 5', () => {
    expect(PLANOS.pro.profissionais).toBe(8);
    expect(PLANOS.pro.iaDia).toBe(5);
  });

  it('getLimites desconhecido cai em trial', () => {
    expect(getLimites('nao_existe')).toEqual(PLANOS.trial);
  });
});

describe('soft delete / isEntityActive', () => {
  it('activo por omissão (sem campo ativo)', () => {
    expect(isEntityActive({ id: '1', nome: 'A' })).toBe(true);
  });

  it('ativo true continua activo', () => {
    expect(isEntityActive({ ativo: true })).toBe(true);
  });

  it('ativo false / 0 / "false" = inactivo', () => {
    expect(isEntityActive({ ativo: false })).toBe(false);
    expect(isEntityActive({ ativo: 0 })).toBe(false);
    expect(isEntityActive({ ativo: 'false' })).toBe(false);
  });

  it('null entity = inactivo', () => {
    expect(isEntityActive(null)).toBe(false);
    expect(isEntityActive(undefined)).toBe(false);
  });

  it('countActive ignora soft-deleted', () => {
    const list = [
      { nome: 'A' },
      { nome: 'B', ativo: false },
      { nome: 'C', ativo: true },
    ];
    expect(countActive(list)).toBe(2);
  });
});

describe('canCreateWithinPlan', () => {
  it('trial bloqueia no 30º cliente já existente ao criar o 31º', () => {
    expect(canCreateWithinPlan('clientes', { clientes: 30 }, 'trial')).toBe(false);
    expect(canCreateWithinPlan('clientes', { clientes: 29 }, 'trial')).toBe(true);
  });

  it('profissionais: soft-deleted não devem contar no total passado', () => {
    // O caller deve passar countActive — aqui só validamos o limiar
    expect(canCreateWithinPlan('profissionais', { profissionais: 1 }, 'trial')).toBe(false);
    expect(canCreateWithinPlan('profissionais', { profissionais: 0 }, 'trial')).toBe(true);
  });

  it('premium sempre permite', () => {
    expect(canCreateWithinPlan('clientes', { clientes: 99999 }, 'premium')).toBe(true);
  });
});

describe('trial dias', () => {
  it('sem trialInicio devolve 14', () => {
    expect(getDiasTrialRestantes(null)).toBe(14);
  });

  it('isTrialAtivo só em plano trial com dias', () => {
    expect(isTrialAtivo('premium', null)).toBe(false);
    expect(isTrialAtivo('trial', null)).toBe(true);
  });
});
