/**
 * PULSO — Homologação: missões-progressão (sem automação, P-022).
 * Concluir missão não concede XP sozinho; o motor manual segue operante.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../../utils/ambiente-homologacao.mjs';

test('INT missões-progressão | conclusão sem XP automático; manual funciona', () => {
  const ambiente = criarBancoTemporario('homolog-int-mp-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'XP manual' });
    const missao = s.servicoMissao.criar(jogador.id, { titulo: 'Entregar relatório' });
    s.servicoMissao.iniciar(missao.id);
    s.servicoMissao.concluir(missao.id);
    assert.equal(s.servicoProgressao.obter(jogador.id).xpTotal, 0);
    assert.equal(s.servicoProgressao.adicionarXp(jogador.id, 100).nivel, 2);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
