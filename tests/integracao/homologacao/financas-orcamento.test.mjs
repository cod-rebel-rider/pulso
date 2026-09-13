/**
 * PULSO — Homologação: finanças-orçamento (despesa consome e reduz saldo).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../../utils/ambiente-homologacao.mjs';

test('INT finanças-orçamento | despesa consome orçamento e reduz saldo', () => {
  const ambiente = criarBancoTemporario('homolog-int-fo-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Ciclo' });
    s.servicoFinanca.criarTransacao(jogador.id, { tipo: 'receita', valorCentavos: 200000, categoria: 'salario', data: '2026-09-01' });
    const orc = s.servicoFinanca.criarOrcamento(jogador.id, { categoria: 'alimentacao', valorCentavos: 60000, inicio: '2026-09-01', fim: '2026-09-30' });
    s.servicoFinanca.criarTransacao(jogador.id, { tipo: 'despesa', valorCentavos: 42000, categoria: 'alimentacao', data: '2026-09-10' });
    assert.equal(s.servicoFinanca.obterCarteira(jogador.id).saldo, 158000);
    const sit = s.servicoFinanca.situacaoOrcamento(orc.id).situacao;
    assert.deepEqual([sit.gasto, sit.disponivel, sit.estourado], [42000, 18000, false]);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
