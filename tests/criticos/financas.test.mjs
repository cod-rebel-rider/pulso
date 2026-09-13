/**
 * PULSO — Homologação CRÍTICA 3: dinheiro nunca diverge do histórico.
 * Severidade: CRÍTICA — saldo divergente = prejuízo real do usuário.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroValidacao } from '../../src/core/erros.js';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../utils/ambiente-homologacao.mjs';

function mundo() {
  const ambiente = criarBancoTemporario('homolog-crit-fin-');
  const s = criarServicos(ambiente.banco);
  return { ...ambiente, ...s, jogador: s.servicoJogador.criar({ nome: 'Cofre' }) };
}

test('CRÍTICO finanças | saldo sempre = soma do histórico persistido', () => {
  const m = mundo();
  try {
    m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'receita', valorCentavos: 100000, categoria: 'salario', data: '2026-09-01' });
    m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'despesa', valorCentavos: 30000, categoria: 'contas', data: '2026-09-02' });
    const historico = m.servicoFinanca.listarTransacoes(m.jogador.id);
    const esperado = historico.reduce((acc, t) => acc + (t.tipo === 'receita' ? t.valorCentavos : -t.valorCentavos), 0);
    assert.equal(m.servicoFinanca.obterCarteira(m.jogador.id).saldo, esperado);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('CRÍTICO finanças | valores inválidos nunca entram no histórico', () => {
  const m = mundo();
  try {
    for (const dados of [
      { tipo: 'receita', valorCentavos: 0, categoria: 'salario', data: '2026-09-10' },
      { tipo: 'despesa', valorCentavos: -5, categoria: 'lazer', data: '2026-09-10' },
      { tipo: 'receita', valorCentavos: 1.5, categoria: 'venda', data: '2026-09-10' },
    ]) {
      assert.throws(() => m.servicoFinanca.criarTransacao(m.jogador.id, dados), ErroValidacao);
    }
    assert.equal(m.servicoFinanca.listarTransacoes(m.jogador.id).length, 0);
    assert.equal(m.servicoFinanca.obterCarteira(m.jogador.id).saldo, 0);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('CRÍTICO finanças | exclusão física recalcula sem deixar resíduo', () => {
  const m = mundo();
  try {
    const t = m.servicoFinanca.criarTransacao(m.jogador.id, { tipo: 'receita', valorCentavos: 50000, categoria: 'freelance', data: '2026-09-10' });
    m.servicoFinanca.excluirTransacao(t.id);
    assert.equal(m.servicoFinanca.listarTransacoes(m.jogador.id).length, 0);
    assert.equal(m.servicoFinanca.obterCarteira(m.jogador.id).saldo, 0);
  } finally {
    destruirBancoTemporario(m);
  }
});
