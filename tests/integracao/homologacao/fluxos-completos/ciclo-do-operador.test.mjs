/**
 * PULSO — Homologação: fluxo completo adaptado ao real.
 * Jogador-missão-conclusão-XP manual-projeto-receita-despesa-orçamento.
 * Loja e compra fora do fluxo: Fase 09 pendente.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../../../utils/ambiente-homologacao.mjs';

test('INT fluxo completo | ciclo de vida do operador em um dia', () => {
  const ambiente = criarBancoTemporario('homolog-int-fluxo-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Ciclo Total', codinome: 'flux' });
    assert.equal(s.servicoStatus.obter(jogador.id).energia, 100);
    assert.equal(s.servicoProgressao.obter(jogador.id).nivel, 1);
    assert.equal(s.servicoFinanca.obterCarteira(jogador.id).saldo, 0);
    const projeto = s.servicoProjeto.criar(jogador.id, { titulo: 'Maratona' });
    const missao = s.servicoMissao.criar(jogador.id, { titulo: 'Treinar 1h' });
    s.servicoProjeto.associarMissao(projeto.id, missao.id);
    s.servicoMissao.iniciar(missao.id);
    s.servicoMissao.concluir(missao.id);
    assert.equal(s.servicoProjeto.obter(projeto.id).progresso, 100);
    assert.equal(s.servicoProgressao.adicionarXp(jogador.id, 100).nivel, 2);
    s.servicoFinanca.criarTransacao(jogador.id, { tipo: 'receita', valorCentavos: 300000, categoria: 'salario', data: '2026-09-05' });
    s.servicoFinanca.criarTransacao(jogador.id, { tipo: 'despesa', valorCentavos: 45000, categoria: 'alimentacao', data: '2026-09-06' });
    assert.equal(s.servicoFinanca.obterCarteira(jogador.id).saldo, 255000);
    const orc = s.servicoFinanca.criarOrcamento(jogador.id, { categoria: 'alimentacao', valorCentavos: 60000, inicio: '2026-09-01', fim: '2026-09-30' });
    assert.equal(s.servicoFinanca.situacaoOrcamento(orc.id).situacao.disponivel, 15000);
    assert.equal(s.servicoFinanca.listarTransacoes(jogador.id).length, 2);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
