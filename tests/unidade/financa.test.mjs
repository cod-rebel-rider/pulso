/**
 * PULSO — Testes unitários: domínio de Finanças (Fase 08)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOEDA,
  NOME_CARTEIRA_PRINCIPAL,
  TIPOS_TRANSACAO,
  TIPOS_TRANSACAO_ORDEM,
  TIPOS_TRANSACAO_ROTULOS,
  CATEGORIAS_RECEITA,
  CATEGORIAS_DESPESA,
  CATEGORIAS_POR_TIPO,
  ROTULO_CATEGORIA,
  validarTipoTransacao,
  validarValorCentavos,
  validarCategoria,
  validarDescricao,
  validarData,
  validarPeriodo,
  validarTransacaoCriacao,
  validarTransacaoEdicao,
  validarNomeOrcamento,
  validarOrcamentoCriacao,
  calcularResumo,
  transacaoNoPeriodo,
  gastosPorCategoria,
  situacaoOrcamento,
} from '../../src/core/dominio/financa.js';
import { ErroValidacao } from '../../src/core/erros.js';

// ── Categorias ───────────────────────────────────────────────────────────
test('categorias: receitas e despesas separadas por tipo, com rótulos', () => {
  assert.deepEqual(
    CATEGORIAS_RECEITA.map((c) => c.valor),
    ['salario', 'freelance', 'missao', 'venda', 'reembolso', 'saldo_inicial', 'outra_receita'],
  );
  assert.deepEqual(
    CATEGORIAS_DESPESA.map((c) => c.valor),
    [
      'alimentacao', 'transporte', 'moradia', 'contas', 'assinaturas', 'lazer',
      'tecnologia', 'musica', 'saude', 'educacao', 'compras', 'outra_despesa',
    ],
  );
  for (const categoria of CATEGORIAS_RECEITA) {
    assert.equal(CATEGORIAS_POR_TIPO.receita.includes(categoria), true);
    assert.equal(CATEGORIAS_POR_TIPO.despesa.includes(categoria), false);
  }
  for (const categoria of CATEGORIAS_DESPESA) {
    assert.equal(CATEGORIAS_POR_TIPO.despesa.includes(categoria), true);
    assert.equal(CATEGORIAS_POR_TIPO.receita.includes(categoria), false);
  }
  assert.equal(ROTULO_CATEGORIA.alimentacao, 'ALIMENTAÇÃO');
  assert.equal(ROTULO_CATEGORIA.salario, 'SALÁRIO');
});

test('categorias: válida e rejeita combinações incompatíveis com o tipo', () => {
  assert.equal(validarCategoria('salario', 'receita'), 'salario');
  assert.equal(validarCategoria('contas', 'despesa'), 'contas');
  assert.throws(() => validarCategoria('salario', 'despesa'), ErroValidacao);
  assert.throws(() => validarCategoria('alimentacao', 'receita'), ErroValidacao);
  assert.throws(() => validarCategoria('inexistente', 'receita'), ErroValidacao);
  assert.throws(() => validarCategoria('compras', 'transferencia'), ErroValidacao);
});

test('moeda e carteira principal centralizados', () => {
  assert.equal(MOEDA, 'BRL');
  assert.equal(NOME_CARTEIRA_PRINCIPAL, 'Carteira Principal');
});

// ── Valores em centavos ──────────────────────────────────────────────────
test('valores: aceita centavos inteiros positivos, inclusive grandes', () => {
  assert.equal(validarValorCentavos(1), 1);
  assert.equal(validarValorCentavos(1299), 1299);
  assert.equal(validarValorCentavos(125075), 125075);
  assert.equal(validarValorCentavos(1234567890), 1234567890);
});

test('valores: rejeita zero, negativos, inválidos e não inteiros', () => {
  assert.throws(() => validarValorCentavos(0), ErroValidacao);
  assert.throws(() => validarValorCentavos(-5000), ErroValidacao);
  assert.throws(() => validarValorCentavos(12.99), ErroValidacao);
  assert.throws(() => validarValorCentavos(NaN), ErroValidacao);
  assert.throws(() => validarValorCentavos(Infinity), ErroValidacao);
  assert.throws(() => validarValorCentavos('1299'), ErroValidacao);
  assert.throws(() => validarValorCentavos(null), ErroValidacao);
  assert.throws(() => validarValorCentavos(undefined), ErroValidacao);
});

test('tipos: apenas receita e despesa na ordem canônica', () => {
  assert.deepEqual(TIPOS_TRANSACAO_ORDEM, ['receita', 'despesa']);
  assert.equal(TIPOS_TRANSACAO.RECEITA, 'receita');
  assert.equal(TIPOS_TRANSACAO.DESPESA, 'despesa');
  assert.equal(TIPOS_TRANSACAO_ROTULOS.receita, 'Receita');
  assert.equal(TIPOS_TRANSACAO_ROTULOS.despesa, 'Despesa');
  assert.equal(validarTipoTransacao('receita'), 'receita');
  assert.throws(() => validarTipoTransacao('transferencia'), ErroValidacao);
});

// ── Descrição ────────────────────────────────────────────────────────────
test('descrição: opcional, aparada e limitada', () => {
  assert.equal(validarDescricao(null), null);
  assert.equal(validarDescricao(''), null);
  assert.equal(validarDescricao('   '), null);
  assert.equal(validarDescricao('  Uber  '), 'Uber');
  assert.equal(validarDescricao('a'.repeat(120)), 'a'.repeat(120));
  assert.throws(() => validarDescricao('a'.repeat(121)), ErroValidacao);
});

// ── Datas ────────────────────────────────────────────────────────────────
test('datas: normaliza para YYYY-MM-DD e rejeita inválidas', () => {
  assert.equal(validarData('2026-09-10'), '2026-09-10');
  assert.equal(validarData('2026-09-10T08:30:00Z'), '2026-09-10');
  assert.throws(() => validarData(''), ErroValidacao);
  assert.throws(() => validarData('2026-13-01'), ErroValidacao);
  assert.throws(() => validarData('2026-02-31'), ErroValidacao);
  assert.throws(() => validarData('amanhã'), ErroValidacao);
  assert.throws(() => validarData('2026-09-32'), ErroValidacao);
});

test('período: limites inclusivos e fim não anterior ao início', () => {
  const periodo = validarPeriodo({ inicio: '2026-09-01', fim: '2026-09-30' });
  assert.deepEqual(periodo, { inicio: '2026-09-01', fim: '2026-09-30' });
  assert.throws(() => validarPeriodo({ inicio: '2026-09-30', fim: '2026-09-01' }), ErroValidacao);
  assert.throws(() => validarPeriodo({ inicio: '2026-09-01', fim: '2026-13-01' }), ErroValidacao);
});
// ── Criação de transação ─────────────────────────────────────────────────
test('transação: criação valida tipo, valor, categoria e data', () => {
  const t = validarTransacaoCriacao({
    tipo: 'despesa',
    valorCentavos: 4590,
    categoria: 'transporte',
    descricao: 'Uber',
    data: '2026-09-10',
  });
  assert.deepEqual(t, {
    tipo: 'despesa',
    valorCentavos: 4590,
    categoria: 'transporte',
    descricao: 'Uber',
    ocorridaEm: '2026-09-10',
  });
});

test('transação: criação rejeita combinação inválida e valor não inteiro', () => {
  assert.throws(
    () => validarTransacaoCriacao({ tipo: 'despesa', valorCentavos: 100, categoria: 'salario', data: '2026-09-10' }),
    ErroValidacao,
  );
  assert.throws(
    () => validarTransacaoCriacao({ tipo: 'despesa', valorCentavos: 100.5, categoria: 'contas', data: '2026-09-10' }),
    ErroValidacao,
  );
  assert.throws(
    () => validarTransacaoCriacao({ tipo: 'despesa', valorCentavos: 0, categoria: 'contas', data: '2026-09-10' }),
    ErroValidacao,
  );
});

test('transação: edição valida campos parciais sem exigir todos', () => {
  const e = validarTransacaoEdicao({ valorCentavos: 8000 });
  assert.equal(e.valorCentavos, 8000);
  assert.equal('tipo' in e, false);
  const t = validarTransacaoEdicao({ tipo: 'receita', data: '2026-09-01' });
  assert.equal(t.tipo, 'receita');
  assert.equal(t.ocorridaEm, '2026-09-01');
  assert.throws(() => validarTransacaoEdicao({ tipo: 'transferencia' }), ErroValidacao);
});

// ── Saldo (única fonte de verdade) ───────────────────────────────────────
test('saldo: 0 + 1000 = 1000; +500 = 1500; -300 = 1200', () => {
  const resumo = calcularResumo([
    { tipo: 'receita', valorCentavos: 1000 },
    { tipo: 'receita', valorCentavos: 500 },
    { tipo: 'despesa', valorCentavos: 300 },
  ]);
  assert.deepEqual(resumo, { receitas: 1500, despesas: 300, saldo: 1200 });
});

test('saldo: 100 - 150 = -50 (negativo permitido)', () => {
  const resumo = calcularResumo([
    { tipo: 'receita', valorCentavos: 100 },
    { tipo: 'despesa', valorCentavos: 150 },
  ]);
  assert.deepEqual(resumo, { receitas: 100, despesas: 150, saldo: -50 });
});

test('saldo: receitas nunca recebem sinal negativo; despesas nunca recebem positivo', () => {
  const resumo = calcularResumo([
    { tipo: 'despesa', valorCentavos: 5000 },
    { tipo: 'receita', valorCentavos: 731428 },
  ]);
  assert.equal(resumo.saldo, 731428 - 5000);
});

test('transacaoNoPeriodo: limites inclusivos', () => {
  const t = { ocorridaEm: '2026-09-30' };
  assert.equal(transacaoNoPeriodo(t, '2026-09-01', '2026-09-30'), true);
  assert.equal(transacaoNoPeriodo(t, '2026-09-30', '2026-10-31'), true);
  assert.equal(transacaoNoPeriodo(t, '2026-09-01', '2026-09-29'), false);
  assert.equal(transacaoNoPeriodo({ ocorridaEm: '2026-10-01' }, '2026-09-01', '2026-09-30'), false);
  assert.equal(transacaoNoPeriodo({ ocorridaEm: '2026-08-31' }, '2026-09-01', '2026-09-30'), false);
});

test('gastosPorCategoria: agrega despesas, ignora receitas, respeita período', () => {
  const transacoes = [
    { tipo: 'despesa', categoria: 'alimentacao', valorCentavos: 42000, ocorridaEm: '2026-09-05' },
    { tipo: 'despesa', categoria: 'alimentacao', valorCentavos: 5000, ocorridaEm: '2026-09-10' },
    { tipo: 'despesa', categoria: 'transporte', valorCentavos: 4500, ocorridaEm: '2026-09-06' },
    { tipo: 'receita', categoria: 'salario', valorCentavos: 300000, ocorridaEm: '2026-09-01' },
    { tipo: 'despesa', categoria: 'lazer', valorCentavos: 9999, ocorridaEm: '2026-10-01' },
  ];
  const gastos = gastosPorCategoria(transacoes, { inicio: '2026-09-01', fim: '2026-09-30' });
  assert.deepEqual(
    gastos,
    [
      { categoria: 'alimentacao', valorCentavos: 47000 },
      { categoria: 'transporte', valorCentavos: 4500 },
    ],
  );
});
// ── Orçamento ────────────────────────────────────────────────────────────
test('orçamento: nome opcional e criação por categoria de despesa', () => {
  assert.equal(validarNomeOrcamento(''), null);
  assert.equal(validarNomeOrcamento('  '), null);
  assert.equal(validarNomeOrcamento('Mensal'), 'Mensal');
  assert.throws(() => validarNomeOrcamento('a'.repeat(61)), ErroValidacao);

  const o = validarOrcamentoCriacao({
    categoria: 'alimentacao',
    nome: 'Padaria',
    valorCentavos: 60000,
    inicio: '2026-09-01',
    fim: '2026-09-30',
  });
  assert.equal(o.categoria, 'alimentacao');
  assert.equal(o.valorCentavos, 60000);

  assert.throws(
    () => validarOrcamentoCriacao({ categoria: 'salario', valorCentavos: 60000, inicio: '2026-09-01', fim: '2026-09-30' }),
    ErroValidacao,
  );
});

test('situação do orçamento: limite 600, gasto 0 → disponível 600', () => {
  const orcamento = { categoria: 'alimentacao', valorCentavos: 60000, inicio: '2026-09-01', fim: '2026-09-30' };
  const situacao = situacaoOrcamento(orcamento, []);
  assert.equal(situacao.gasto, 0);
  assert.equal(situacao.disponivel, 60000);
  assert.equal(situacao.estourado, false);
  assert.equal(situacao.percentual, 0);
});

test('situação do orçamento: limite 600, gasto 420 → disponível 180', () => {
  const orcamento = { categoria: 'alimentacao', valorCentavos: 60000, inicio: '2026-09-01', fim: '2026-09-30' };
  const situacao = situacaoOrcamento(orcamento, [
    { tipo: 'despesa', categoria: 'alimentacao', valorCentavos: 42000, ocorridaEm: '2026-09-10' },
  ]);
  assert.equal(situacao.gasto, 42000);
  assert.equal(situacao.disponivel, 18000);
  assert.equal(situacao.estourado, false);
});

test('situação do orçamento: limite 600, gasto 650 → estourado -50', () => {
  const orcamento = { categoria: 'alimentacao', valorCentavos: 60000, inicio: '2026-09-01', fim: '2026-09-30' };
  const situacao = situacaoOrcamento(orcamento, [
    { tipo: 'despesa', categoria: 'alimentacao', valorCentavos: 65000, ocorridaEm: '2026-09-10' },
  ]);
  assert.equal(situacao.gasto, 65000);
  assert.equal(situacao.disponivel, -5000);
  assert.equal(situacao.estourado, true);
});

test('situação do orçamento: despesas fora do período ou de outra categoria não contam', () => {
  const orcamento = { categoria: 'alimentacao', valorCentavos: 60000, inicio: '2026-09-01', fim: '2026-09-30' };
  const transacoes = [
    { tipo: 'despesa', categoria: 'alimentacao', valorCentavos: 1000, ocorridaEm: '2026-08-31' }, // antes
    { tipo: 'despesa', categoria: 'alimentacao', valorCentavos: 2000, ocorridaEm: '2026-10-01' }, // depois
    { tipo: 'despesa', categoria: 'transporte', valorCentavos: 9999, ocorridaEm: '2026-09-10' }, // categoria errada
    { tipo: 'receita', categoria: 'alimentacao', valorCentavos: 50000, ocorridaEm: '2026-09-10' }, // receita não consome
  ];
  const situacao = situacaoOrcamento(orcamento, transacoes);
  assert.equal(situacao.gasto, 0);
  assert.equal(situacao.disponivel, 60000);
});

test('situação do orçamento: várias despesas dentro do período somam', () => {
  const orcamento = { categoria: 'transporte', valorCentavos: 40000, inicio: '2026-09-01', fim: '2026-09-30' };
  const situacao = situacaoOrcamento(orcamento, [
    { tipo: 'despesa', categoria: 'transporte', valorCentavos: 10000, ocorridaEm: '2026-09-01' },
    { tipo: 'despesa', categoria: 'transporte', valorCentavos: 8000, ocorridaEm: '2026-09-30' },
    { tipo: 'despesa', categoria: 'transporte', valorCentavos: 2000, ocorridaEm: '2026-10-01' },
  ]);
  assert.equal(situacao.gasto, 18000);
  assert.equal(situacao.disponivel, 22000);
});