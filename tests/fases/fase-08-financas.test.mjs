/**
 * PULSO — Homologação FASE 08 — Finanças (CRÍTICA), domínio.
 * Tipos, categorias por tipo, centavos, datas, saldo e orçamento.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarTipoTransacao, validarCategoria } from '../../src/core/dominio/financa.js';
import { validarValorCentavos, validarData } from '../../src/core/dominio/financa.js';
import { calcularResumo, situacaoOrcamento } from '../../src/core/dominio/financa.js';
import { ErroValidacao } from '../../src/core/erros.js';

test('F08 finanças | domínio | tipo e categoria validados por tipo', () => {
  assert.equal(validarTipoTransacao('receita'), 'receita');
  assert.throws(() => validarTipoTransacao('transferencia'), ErroValidacao);
  assert.equal(validarCategoria('salario', 'receita'), 'salario');
  assert.throws(() => validarCategoria('salario', 'despesa'), ErroValidacao);
});

test('F08 finanças | domínio | centavos: zero, negativo e quebrado rejeitados', () => {
  assert.throws(() => validarValorCentavos(0), ErroValidacao);
  assert.throws(() => validarValorCentavos(-100), ErroValidacao);
  assert.throws(() => validarValorCentavos(10.5), ErroValidacao);
  assert.equal(validarValorCentavos(1), 1);
});

test('F08 finanças | domínio | datas: dia válido aceito; impossível rejeitado', () => {
  assert.equal(validarData('2026-09-10'), '2026-09-10');
  assert.throws(() => validarData('2026-02-31'), ErroValidacao);
  assert.throws(() => validarData(''), ErroValidacao);
});

test('F08 finanças | domínio | saldo igual receitas menos despesas', () => {
  assert.deepEqual(
    calcularResumo([{ tipo: 'receita', valorCentavos: 1000 }, { tipo: 'despesa', valorCentavos: 300 }]),
    { receitas: 1000, despesas: 300, saldo: 700 },
  );
  assert.equal(calcularResumo([{ tipo: 'despesa', valorCentavos: 150 }]).saldo, -150);
});

test('F08 finanças | domínio | estouro sinalizado sem bloquear', () => {
  const s = situacaoOrcamento(
    { categoria: 'x', valorCentavos: 100, inicio: '2026-09-01', fim: '2026-09-30' },
    [{ tipo: 'despesa', categoria: 'x', valorCentavos: 150, ocorridaEm: '2026-09-10' }],
  );
  assert.equal(s.estourado, true);
  assert.equal(s.disponivel, -50);
});
