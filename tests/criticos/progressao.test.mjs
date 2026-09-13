/**
 * PULSO — Homologação CRÍTICA 4: progressão/XP sem estados impossíveis.
 * Severidade: ALTA — XP negativo ou nível divergente quebra a confiança.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroValidacao } from '../../src/core/erros.js';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../utils/ambiente-homologacao.mjs';

test('CRÍTICO progressão | XP negativo e atributo sem ponto bloqueados', () => {
  const ambiente = criarBancoTemporario('homolog-crit-prog-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Nível' });
    assert.throws(() => s.servicoProgressao.adicionarXp(jogador.id, -10), ErroValidacao);
    assert.throws(() => s.servicoProgressao.aumentarAtributo(jogador.id, 'foco', 1), ErroValidacao, 'sem pontos');
    const visao = s.servicoProgressao.obter(jogador.id);
    assert.deepEqual([visao.xpTotal, visao.nivel, visao.pontosDisponiveis], [0, 1, 0]);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});

test('CRÍTICO progressão | múltiplos level-ups acumulam pontos corretamente', () => {
  const ambiente = criarBancoTemporario('homolog-crit-multi-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Salto' });
    const r = s.servicoProgressao.adicionarXp(jogador.id, 300);
    assert.equal(r.nivel, 3, '0→300 XP = níveis 1→2 (100) →3 (200)');
    assert.equal(r.pontosDisponiveis, 2);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
