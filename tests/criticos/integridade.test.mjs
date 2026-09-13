/**
 * PULSO — Homologação CRÍTICA 2: integridade entre entidades.
 * Severidade: CRÍTICA — FK órfã corrompe carteira/histórico/progresso.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroConflito } from '../../src/core/erros.js';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../utils/ambiente-homologacao.mjs';

test('CRÍTICO integridade | transação de jogador inexistente bloqueada', () => {
  const ambiente = criarBancoTemporario('homolog-crit-integ-');
  const s = criarServicos(ambiente.banco);
  try {
    s.servicoJogador.criar({ nome: 'Dono' });
    assert.throws(() => s.servicoFinanca.criarTransacao(99999, { tipo: 'receita', valorCentavos: 100, categoria: 'venda', data: '2026-09-10' }), ErroConflito);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});

test('CRÍTICO integridade | missão órfã rejeitada pelo banco (FK)', () => {
  const ambiente = criarBancoTemporario('homolog-crit-fk-');
  const s = criarServicos(ambiente.banco);
  try {
    assert.throws(() => ambiente.banco.prepare('INSERT INTO missao (jogador_id, titulo) VALUES (424242, ?)').run('órfã'));
    assert.equal(ambiente.banco.prepare('SELECT COUNT(*) AS n FROM missao WHERE jogador_id = 424242').get().n, 0);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});

test('CRÍTICO integridade | CASCADE: remover jogador limpa status/progresso/missões', () => {
  const ambiente = criarBancoTemporario('homolog-crit-cascade-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Ecosistema' });
    s.servicoMissao.criar(jogador.id, { titulo: 'Dependente' });
    ambiente.banco.prepare('DELETE FROM jogador WHERE id = ?').run(jogador.id);
    assert.equal(ambiente.banco.prepare('SELECT COUNT(*) AS n FROM jogador_status WHERE jogador_id = ?').get(jogador.id).n, 0);
    assert.equal(ambiente.banco.prepare('SELECT COUNT(*) AS n FROM missao WHERE jogador_id = ?').get(jogador.id).n, 0);
    assert.equal(ambiente.banco.prepare('SELECT COUNT(*) AS n FROM jogador_progressao WHERE jogador_id = ?').get(jogador.id).n, 0);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
