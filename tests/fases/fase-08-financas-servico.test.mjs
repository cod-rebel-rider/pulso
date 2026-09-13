/**
 * PULSO — Homologação FASE 08 — Finanças (CRÍTICA), serviço.
 * Carteira, transações, edição, exclusão, orçamentos inclusivos.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroValidacao, ErroConflito } from '../../src/core/erros.js';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../utils/ambiente-homologacao.mjs';

function mundo() {
  const ambiente = criarBancoTemporario('homolog-f08-');
  const servicos = criarServicos(ambiente.banco);
  const jogador = servicos.servicoJogador.criar({ nome: 'Finanças' });
  return { ...ambiente, ...servicos, jogador };
}

test('F08 finanças | carteira | nasce zerada; idempotente; inexistente rejeitado', () => {
  const m = mundo();
  try {
    const c = m.servicoFinanca.obterCarteira(m.jogador.id);
    assert.equal(c.saldo, 0);
    assert.equal(c.moeda, 'BRL');
    assert.equal(m.servicoFinanca.garantirCarteiraPrincipal(m.jogador.id).id, c.id);
    assert.throws(() => m.servicoFinanca.obterCarteira(99999), ErroConflito);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F08 finanças | transações | receita aumenta e despesa reduz', () => {
  const m = mundo();
  try {
    m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'receita', valorCentavos: 300000, categoria: 'salario', data: '2026-09-05' });
    assert.equal(m.servicoFinanca.obterCarteira(m.jogador.id).saldo, 300000);
    m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'despesa', valorCentavos: 15000, categoria: 'transporte', data: '2026-09-06' });
    assert.equal(m.servicoFinanca.obterCarteira(m.jogador.id).saldo, 285000);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F08 finanças | transações | categoria incompatível rejeitada sem mexer no saldo', () => {
  const m = mundo();
  try {
    assert.throws(() => m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'receita', valorCentavos: 100, categoria: 'transporte', data: '2026-09-10' }), ErroValidacao);
    assert.equal(m.servicoFinanca.obterCarteira(m.jogador.id).saldo, 0);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F08 finanças | transações | edição recalcula; exclusão devolve saldo', () => {
  const m = mundo();
  try {
    const t = m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'despesa', valorCentavos: 50000, categoria: 'lazer', data: '2026-09-10' });
    m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'receita', valorCentavos: 100000, categoria: 'salario', data: '2026-09-10' });
    assert.equal(m.servicoFinanca.obterCarteira(m.jogador.id).saldo, 50000);
    m.servicoFinanca.atualizarTransacao(t.id, { valorCentavos: 20000 });
    assert.equal(m.servicoFinanca.obterCarteira(m.jogador.id).saldo, 80000);
    m.servicoFinanca.excluirTransacao(t.id);
    assert.equal(m.servicoFinanca.obterCarteira(m.jogador.id).saldo, 100000);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F08 finanças | orçamentos | limites inclusivos; receitas não consomem', () => {
  const m = mundo();
  try {
    const o = m.servicoFinanca.criarOrcamento(m.jogador.id, { categoria: 'transporte', valorCentavos: 50000, inicio: '2026-09-01', fim: '2026-09-30' });
    m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'despesa', valorCentavos: 10000, categoria: 'transporte', data: '2026-09-01' });
    m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'despesa', valorCentavos: 10000, categoria: 'transporte', data: '2026-09-30' });
    m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'despesa', valorCentavos: 10000, categoria: 'transporte', data: '2026-08-31' });
    m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'receita', valorCentavos: 99999, categoria: 'salario', data: '2026-09-15' });
    const s = m.servicoFinanca.situacaoOrcamento(o.id).situacao;
    assert.equal(s.gasto, 20000);
    assert.equal(s.disponivel, 30000);
    assert.equal(s.estourado, false);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F08 finanças | validação | período invertido e receita em orçamento rejeitados', () => {
  const m = mundo();
  try {
    assert.throws(() => m.servicoFinanca.criarOrcamento(m.jogador.id, { categoria: 'lazer', valorCentavos: 100, inicio: '2026-09-30', fim: '2026-09-01' }), ErroValidacao);
    assert.throws(() => m.servicoFinanca.criarOrcamento(m.jogador.id, { categoria: 'salario', valorCentavos: 100, inicio: '2026-09-01', fim: '2026-09-30' }), ErroValidacao);
  } finally {
    destruirBancoTemporario(m);
  }
});
