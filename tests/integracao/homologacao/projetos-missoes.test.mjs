/**
 * PULSO — Homologação: projetos-missões (vínculo 1:N e progresso 0-50-100).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../../utils/ambiente-homologacao.mjs';

test('INT projetos-missões | vincular 2 missões reflete progresso 0-50-100', () => {
  const ambiente = criarBancoTemporario('homolog-int-pm-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Direção' });
    const projeto = s.servicoProjeto.criar(jogador.id, { titulo: 'Site' });
    const m1 = s.servicoMissao.criar(jogador.id, { titulo: 'Layout' });
    const m2 = s.servicoMissao.criar(jogador.id, { titulo: 'Conteúdo' });
    s.servicoProjeto.associarMissao(projeto.id, m1.id);
    s.servicoProjeto.associarMissao(projeto.id, m2.id);
    assert.equal(s.servicoProjeto.obter(projeto.id).progresso, 0);
    s.servicoMissao.iniciar(m1.id);
    s.servicoMissao.concluir(m1.id);
    assert.equal(s.servicoProjeto.obter(projeto.id).progresso, 50);
    s.servicoMissao.iniciar(m2.id);
    s.servicoMissao.concluir(m2.id);
    const fim = s.servicoProjeto.obter(projeto.id);
    assert.equal(fim.progresso, 100);
    assert.equal(fim.prontaParaEncerrar, true);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
