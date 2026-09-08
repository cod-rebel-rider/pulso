/**
 * PULSO — Testes unitários: domínio de Status (Fase 04)
 *
 * Validam as regras puras (validação, limites, cálculo) sem depender
 * do banco de dados ou do Electron.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITE_MINIMO,
  LIMITE_MAXIMO,
  STATUS_DISPONIVEIS,
  VALORES_INICIAIS,
  validarNomeStatus,
  limitar,
  validarDelta,
  calcularNovoValor,
  validarValorAbsoluto,
} from '../../src/core/dominio/status.js';
import { ErroValidacao } from '../../src/core/erros.js';

test('constantes: limites 0–100 e 4 status', () => {
  assert.equal(LIMITE_MINIMO, 0);
  assert.equal(LIMITE_MAXIMO, 100);
  assert.deepEqual(STATUS_DISPONIVEIS, ['energia', 'foco', 'estresse', 'criatividade']);
  assert.deepEqual(VALORES_INICIAIS, { energia: 100, foco: 100, estresse: 0, criatividade: 100 });
});

test('validarNomeStatus aceita nomes válidos', () => {
  for (const nome of STATUS_DISPONIVEIS) {
    assert.equal(validarNomeStatus(nome), nome);
  }
});

test('validarNomeStatus rejeita nome desconhecido', () => {
  assert.throws(() => validarNomeStatus('mana'), ErroValidacao);
  assert.throws(() => validarNomeStatus(''), ErroValidacao);
  assert.throws(() => validarNomeStatus(123), ErroValidacao);
});

test('limitar mantém dentro de 0–100', () => {
  assert.equal(limitar(50), 50);
  assert.equal(limitar(0), 0);
  assert.equal(limitar(100), 100);
  assert.equal(limitar(150), 100);
  assert.equal(limitar(-20), 0);
});

test('validarDelta aceita números finitos', () => {
  assert.equal(validarDelta(-10), -10);
  assert.equal(validarDelta(15), 15);
  assert.equal(validarDelta(0), 0);
});

test('validarDelta rejeita valores inválidos', () => {
  assert.throws(() => validarDelta('abc'), ErroValidacao);
  assert.throws(() => validarDelta(NaN), ErroValidacao);
  assert.throws(() => validarDelta(Infinity), ErroValidacao);
  assert.throws(() => validarDelta(null), ErroValidacao);
});

test('calcularNovoValor aplica delta e limita', () => {
  assert.equal(calcularNovoValor('energia', 100, -10), 90);
  assert.equal(calcularNovoValor('foco', 60, 15), 75);
  assert.equal(calcularNovoValor('energia', 95, 20), 100); // teto
  assert.equal(calcularNovoValor('foco', 5, -20), 0); // piso
});

test('calcularNovoValor rejeita status desconhecido', () => {
  assert.throws(() => calcularNovoValor('mana', 50, 10), ErroValidacao);
});

test('calcularNovoValor rejeita delta inválido', () => {
  assert.throws(() => calcularNovoValor('energia', 50, 'dez'), ErroValidacao);
});

test('validarValorAbsoluto valida e limita valor direto', () => {
  assert.equal(validarValorAbsoluto('energia', 75), 75);
  assert.equal(validarValorAbsoluto('estresse', 150), 100);
  assert.equal(validarValorAbsoluto('foco', -10), 0);
});

test('validarValorAbsoluto rejeita status desconhecido e valor inválido', () => {
  assert.throws(() => validarValorAbsoluto('mana', 50), ErroValidacao);
  assert.throws(() => validarValorAbsoluto('energia', 'muito'), ErroValidacao);
});
