/**
 * PULSO — Homologação: status-missões (independência).
 * Missões não alteram status automaticamente (pendência P-022).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../../utils/ambiente-homologacao.mjs';

test('INT status-missões | concluir missão não altera status sozinha', () => {
  const ambiente = criarBancoTemporario('homolog-int-sm-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Neutra' });
    const antes = s.servicoStatus.obter(jogador.id);
    const missao = s.servicoMissao.criar(jogador.id, { titulo: 'Correr 5km' });
    s.servicoMissao.iniciar(missao.id);
    s.servicoMissao.concluir(missao.id);
    const depois = s.servicoStatus.obter(jogador.id);
    assert.deepEqual(
      [depois.energia, depois.foco, depois.estresse, depois.criatividade],
      [antes.energia, antes.foco, antes.estresse, antes.criatividade],
    );
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
