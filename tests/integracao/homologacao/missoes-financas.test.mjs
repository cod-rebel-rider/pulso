/**
 * PULSO — Homologação: missões-finanças (sem recompensa automática).
 * Categoria missao existe para lançamento manual (financas.md).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../../utils/ambiente-homologacao.mjs';

test('INT missões-finanças | conclusão sem receita automática; manual ok', () => {
  const ambiente = criarBancoTemporario('homolog-int-mf-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Sem recompensa' });
    const missao = s.servicoMissao.criar(jogador.id, { titulo: 'Freela' });
    s.servicoMissao.iniciar(missao.id);
    s.servicoMissao.concluir(missao.id);
    assert.equal(s.servicoFinanca.obterCarteira(jogador.id).saldo, 0);
    s.servicoFinanca.criarTransacao(jogador.id, { tipo: 'receita', valorCentavos: 50000, categoria: 'missao', data: '2026-09-10' });
    assert.equal(s.servicoFinanca.obterCarteira(jogador.id).saldo, 50000);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
