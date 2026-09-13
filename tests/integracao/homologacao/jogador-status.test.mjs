/**
 * PULSO — Homologação: jogador-status (criação atômica e isolamento).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../../utils/ambiente-homologacao.mjs';

test('INT jogador-status | nascimento cria status inicial atomizado', () => {
  const ambiente = criarBancoTemporario('homolog-int-js-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Integração' });
    const status = s.servicoStatus.obter(jogador.id);
    assert.deepEqual([status.energia, status.foco, status.estresse, status.criatividade], [100, 100, 0, 100]);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});

test('INT jogador-status | status acompanha o jogador em consultas repetidas', () => {
  const ambiente = criarBancoTemporario('homolog-int-js2-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Eco' });
    s.servicoStatus.alterar(jogador.id, 'foco', -40);
    assert.equal(s.servicoStatus.obter(jogador.id).foco, 60);
    assert.equal(s.servicoJogador.obter().id, jogador.id);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
