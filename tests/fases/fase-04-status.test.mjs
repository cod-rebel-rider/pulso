/**
 * PULSO — Homologação FASE 04 — Sistema de Status.
 * 4 status, faixa 0–100, iniciais 100/100/0/100, delta, persistência,
 * recuperação de jogador legado sem status.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { STATUS_DISPONIVEIS, VALORES_INICIAIS, limitar } from '../../src/core/dominio/status.js';
import { validarNomeStatus, validarDelta, calcularNovoValor } from '../../src/core/dominio/status.js';
import { validarValorAbsoluto } from '../../src/core/dominio/status.js';
import { ErroValidacao, ErroConflito } from '../../src/core/erros.js';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../utils/ambiente-homologacao.mjs';

function mundo() {
  const ambiente = criarBancoTemporario('homolog-f04-');
  const servicos = criarServicos(ambiente.banco);
  const jogador = servicos.servicoJogador.criar({ nome: 'Status' });
  return { ...ambiente, ...servicos, jogador };
}

test('F04 status | domínio | constantes: 4 status e iniciais 100/100/0/100', () => {
  assert.deepEqual(STATUS_DISPONIVEIS, ['energia', 'foco', 'estresse', 'criatividade']);
  assert.deepEqual(VALORES_INICIAIS, { energia: 100, foco: 100, estresse: 0, criatividade: 100 });
});

test('F04 status | domínio | limitar prende em 0–100', () => {
  assert.equal(limitar(150), 100);
  assert.equal(limitar(-20), 0);
  assert.equal(limitar(50), 50);
});

test('F04 status | validação | status desconhecido rejeitado', () => {
  assert.throws(() => validarNomeStatus('mana'), ErroValidacao);
  assert.throws(() => calcularNovoValor('mana', 50, 1), ErroValidacao);
  assert.throws(() => validarValorAbsoluto('xp', 10), ErroValidacao);
});

test('F04 status | validação | delta não-numérico rejeitado', () => {
  for (const delta of ['dez', NaN, Infinity, null, undefined]) {
    assert.throws(() => validarDelta(delta), ErroValidacao, String(delta));
  }
});

test('F04 status | domínio | calcularNovoValor aplica delta com teto/piso', () => {
  assert.equal(calcularNovoValor('energia', 100, -10), 90);
  assert.equal(calcularNovoValor('energia', 95, 20), 100);
  assert.equal(calcularNovoValor('foco', 5, -20), 0);
});

test('F04 status | serviço | jogador nasce com status inicial', () => {
  const m = mundo();
  try {
    const s = m.servicoStatus.obter(m.jogador.id);
    assert.deepEqual([s.energia, s.foco, s.estresse, s.criatividade], [100, 100, 0, 100]);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F04 status | serviço | alterar aplica delta e persiste', () => {
  const m = mundo();
  try {
    assert.equal(m.servicoStatus.alterar(m.jogador.id, 'energia', -25).energia, 75);
    assert.equal(m.servicoStatus.alterar(m.jogador.id, 'estresse', 30).estresse, 30);
    assert.equal(m.servicoStatus.obter(m.jogador.id).energia, 75);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F04 status | serviço | teto/piso nunca estouram com delta extremo', () => {
  const m = mundo();
  try {
    assert.equal(m.servicoStatus.alterar(m.jogador.id, 'energia', 9999).energia, 100);
    assert.equal(m.servicoStatus.alterar(m.jogador.id, 'foco', -9999).foco, 0);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F04 status | erros | jogador inexistente rejeitado; app segue funcional', () => {
  const m = mundo();
  try {
    assert.throws(() => m.servicoStatus.obter(99999), ErroConflito);
    assert.throws(() => m.servicoStatus.alterar(99999, 'energia', -5), ErroConflito);
    assert.throws(() => m.servicoStatus.alterar(m.jogador.id, 'mana', 5), ErroValidacao);
    assert.equal(m.servicoStatus.obter(m.jogador.id).energia, 100);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F04 status | serviço | obter é idempotente (sem duplicar)', () => {
  const m = mundo();
  try {
    const a = m.servicoStatus.obter(m.jogador.id);
    const b = m.servicoStatus.obter(m.jogador.id);
    assert.equal(a.id, b.id);
    assert.equal(m.banco.prepare('SELECT COUNT(*) AS n FROM jogador_status WHERE jogador_id = ?').get(m.jogador.id).n, 1);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F04 status | recuperação | jogador legado sem status inicializado sob demanda', () => {
  const m = mundo();
  try {
    const legado = m.repositorioJogador.criar({ nome: 'Legado', codinome: null });
    assert.equal(m.repositorioStatus.existe(legado.id), false);
    assert.equal(m.servicoStatus.obter(legado.id).energia, 100);
    assert.equal(m.repositorioStatus.existe(legado.id), true);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F04 status | persistência | valores sobrevivem a fechar-reabrir', () => {
  const m = mundo();
  try {
    m.servicoStatus.alterar(m.jogador.id, 'energia', -30);
    const caminho = join(m.diretorio, 'pulso.db');
    m.banco.close();
    const reaberto = new DatabaseSync(caminho);
    try {
      assert.equal(reaberto.prepare('SELECT energia FROM jogador_status WHERE jogador_id = ?').get(m.jogador.id).energia, 70);
    } finally {
      reaberto.close();
    }
    m.banco = new DatabaseSync(caminho);
  } finally {
    destruirBancoTemporario(m);
  }
});
