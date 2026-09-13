/**
 * PULSO — Homologação CRÍTICA 1: persistência fecha→reabre sem perda.
 * Severidade: CRÍTICA — perda de dados inviabiliza o produto.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../utils/ambiente-homologacao.mjs';

test('CRÍTICO persistência | jogador+status+missão+XPsobrevivem ao reinício', () => {
  const ambiente = criarBancoTemporario('homolog-crit-persist-');
  const s = criarServicos(ambiente.banco);
  try {
    const jogador = s.servicoJogador.criar({ nome: 'Sobrevivente' });
    s.servicoStatus.alterar(jogador.id, 'energia', -20);
    const missao = s.servicoMissao.criar(jogador.id, { titulo: 'Guardar' });
    s.servicoProgressao.adicionarXp(jogador.id, 100);
    s.servicoFinanca.criarTransacao(jogador.id, { tipo: 'receita', valorCentavos: 10000, categoria: 'salario', data: '2026-09-10' });
    const caminho = join(ambiente.diretorio, 'pulso.db');
    ambiente.banco.close();
    const reaberto = new DatabaseSync(caminho);
    try {
      assert.equal(reaberto.prepare('SELECT nome FROM jogador WHERE id = ?').get(jogador.id).nome, 'Sobrevivente');
      assert.equal(reaberto.prepare('SELECT energia FROM jogador_status WHERE jogador_id = ?').get(jogador.id).energia, 80);
      assert.equal(reaberto.prepare('SELECT titulo FROM missao WHERE id = ?').get(missao.id).titulo, 'Guardar');
      assert.equal(reaberto.prepare('SELECT xp_total FROM jogador_progressao WHERE jogador_id = ?').get(jogador.id).xp_total, 100);
      assert.equal(reaberto.prepare('SELECT COUNT(*) AS n FROM transacao').get().n, 1);
    } finally {
      reaberto.close();
    }
    ambiente.banco = new DatabaseSync(caminho);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
