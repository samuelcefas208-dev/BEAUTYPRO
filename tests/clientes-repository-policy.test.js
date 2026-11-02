/**
 * F2-05 — testes de política do repository de clientes (Opção A).
 * Caracterização apenas. NÃO prova browser, IDB, sync ou RLS.
 */
import { describe, it, expect } from 'vitest';
import {
  isClienteActive,
  filterClientesActive,
  validateClienteCreateShape,
  createInputShouldOmitSalaoIdRequirement,
  isCreateRejected,
  isDeleteRejected,
  getClienteDeleteMode,
  storesAffectedByClienteRename,
  repositoryMethodNames,
  CLIENTE_CREATE_REQUIRED_FIELDS,
  CLIENTE_DELETE_MODE,
  CLIENTE_DELETE_ROLES,
} from '../domain/pure/clientes-repository-policy.mjs';

describe('F2-05 clientes repository policy (caracterização)', () => {
  describe('isClienteActive / listActive', () => {
    it('activo por omissão e com ativo true', () => {
      expect(isClienteActive({ id: '1', nome: 'A' })).toBe(true);
      expect(isClienteActive({ id: '1', ativo: true })).toBe(true);
    });

    it('inactivo para false, 0 e string false', () => {
      expect(isClienteActive({ ativo: false })).toBe(false);
      expect(isClienteActive({ ativo: 0 })).toBe(false);
      expect(isClienteActive({ ativo: 'false' })).toBe(false);
    });

    it('filterClientesActive remove inactivos', () => {
      const list = [
        { id: '1', nome: 'A' },
        { id: '2', nome: 'B', ativo: false },
        { id: '3', nome: 'C', ativo: true },
      ];
      expect(filterClientesActive(list).map((c) => c.id)).toEqual(['1', '3']);
    });
  });

  describe('validateClienteCreateShape', () => {
    it('exige nome e telefone (campos mínimos)', () => {
      expect(CLIENTE_CREATE_REQUIRED_FIELDS).toEqual(['nome', 'telefone']);
      expect(validateClienteCreateShape({ nome: 'Ana', telefone: '923456789' }).ok).toBe(true);
      expect(validateClienteCreateShape({ nome: '  ', telefone: '923456789' }).reason).toBe(
        'NOME_OBRIGATORIO',
      );
      expect(validateClienteCreateShape({ nome: 'Ana', telefone: '' }).reason).toBe(
        'TELEFONE_OBRIGATORIO',
      );
      expect(validateClienteCreateShape(null).ok).toBe(false);
    });

    it('não exige salao_id no create local', () => {
      expect(createInputShouldOmitSalaoIdRequirement({ nome: 'A', telefone: '9' })).toBe(true);
    });
  });

  describe('resultados de rejeição', () => {
    it('null = create rejeitado', () => {
      expect(isCreateRejected(null)).toBe(true);
      expect(isCreateRejected(undefined)).toBe(true);
      expect(isCreateRejected({ id: '1' })).toBe(false);
    });

    it('false = delete rejeitado', () => {
      expect(isDeleteRejected(false)).toBe(true);
      expect(isDeleteRejected(true)).toBe(false);
    });
  });

  describe('delete mode e RBAC documentados', () => {
    it('fluxo principal = hard delete', () => {
      expect(getClienteDeleteMode()).toBe('hard');
      expect(CLIENTE_DELETE_MODE).toBe('hard');
    });

    it('roles de delete = admin e gerente', () => {
      expect(CLIENTE_DELETE_ROLES).toEqual(['admin', 'gerente']);
    });
  });

  describe('rename side-effect e API conceptual', () => {
    it('rename afecta movimentos e agendamentos', () => {
      expect(storesAffectedByClienteRename()).toEqual(['movimentos', 'agendamentos']);
    });

    it('métodos da fachada conceptual', () => {
      expect(repositoryMethodNames()).toEqual([
        'listAll',
        'listActive',
        'getById',
        'create',
        'update',
        'remove',
      ]);
    });
  });
});
