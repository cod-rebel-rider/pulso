/**
 * PULSO — Homologação FASE 06 — Progressão.
 * Curva XP (100 por nível), nível derivado, pontos, atributos, persistência.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpNecessarioParaProximoNivel, calcularNivel } from '../../src/core/dominio/progressao.js';
import { calcularProgresso, adicionarXp, aumentarAtributo } from '../../src/core/dominio/progressao.js';
import { atributosIniciais, ATRIBUTOS_DISPONIVEIS } from '../../src/core/dominio/progressao.js';
import { ErroValidacao, ErroConflito } from '../../src/core/erros.js';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../utils/ambiente-homologacao.mjs';

function mundo() {
  const ambiente = criarBancoTemporario('homolog-f06-');
  const servicos = criarServicos(ambiente.banco);
  const jogador = servicos.servicoJogador.criar({ nome: 'Progressão' });
  return { ...ambiente, ...servicos, jogador };
}

test('F06 progressão | domínio | curva 100 por nível', () => {
  assert.equal(xpNecessarioParaProximoNivel(1), 100);
  assert.equal(xpNecessarioParaProximoNivel(2), 200);
  assert.throws(() => xpNecessarioParaProximoNivel(0), ErroValidacao);
});

test('F06 progressão | domínio | nível derivado do XP', () => {
  assert.equal(calcularNivel(0), 1);
  assert.equal(calcularNivel(99), 1);
  assert.equal(calcularNivel(100), 2);
  assert.equal(calcularNivel(300), 3);
  assert.throws(() => calcularNivel(-1), ErroValidacao);
  assert.throws(() => calcularNivel(10.5), ErroValidacao);
});

test('F06 progressão | domínio | progresso detalha nível e fração', () => {
  assert.deepEqual(calcularProgresso(0), { nivel: 1, xpNoNivel: 0, xpNecessario: 100, progresso: 0 });
  assert.equal(calcularProgresso(50).progresso, 0.5);
});

test('F06 progressão | domínio | adicionarXp concede 1 ponto por nível', () => {
  const r = adicionarXp({ xpTotal: 0, nivel: 1, pontosDisponiveis: 0 }, 100);
  assert.equal(r.nivel, 2);
  assert.equal(r.pontosDisponiveis, 1);
  assert.throws(() => adicionarXp({ xpTotal: 0, nivel: 1, pontosDisponiveis: 0 }, -5), ErroValidacao);
});

test('F06 progressão | domínio | atributos em 1; excesso e nome inválido bloqueados', () => {
  assert.equal(Object.keys(atributosIniciais()).length, 7);
  assert.equal(ATRIBUTOS_DISPONIVEIS.length, 7);
  const base = { atributos: atributosIniciais(), pontosDisponiveis: 1 };
  assert.equal(aumentarAtributo(base, 'foco', 1).atributos.foco, 2);
  assert.throws(() => aumentarAtributo(base, 'foco', 2), ErroValidacao);
  assert.throws(() => aumentarAtributo(base, 'mana', 1), ErroValidacao);
  assert.throws(() => aumentarAtributo(base, 'foco', 0), ErroValidacao);
});

test('F06 progressão | serviço | nascimento no nível 1 com 0 XP e pontos', () => {
  const m = mundo();
  try {
    const v = m.servicoProgressao.obter(m.jogador.id);
    assert.deepEqual([v.nivel, v.xpTotal, v.pontosDisponiveis], [1, 0, 0]);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F06 progressão | serviço | XP persiste e level-up concede ponto gastável', () => {
  const m = mundo();
  try {
    m.servicoProgressao.adicionarXp(m.jogador.id, 75);
    assert.equal(m.servicoProgressao.obter(m.jogador.id).nivel, 1);
    m.servicoProgressao.adicionarXp(m.jogador.id, 25);
    assert.equal(m.servicoProgressao.obter(m.jogador.id).nivel, 2);
    const d = m.servicoProgressao.aumentarAtributo(m.jogador.id, 'tecnologia', 1);
    assert.equal(d.atributos.tecnologia, 2);
    assert.equal(d.pontosDisponiveis, 0);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F06 progressão | erros | negativo, inexistente e inválido rejeitados', () => {
  const m = mundo();
  try {
    assert.throws(() => m.servicoProgressao.adicionarXp(m.jogador.id, -5), ErroValidacao);
    assert.throws(() => m.servicoProgressao.obter(99999), ErroConflito);
    assert.throws(() => m.servicoProgressao.adicionarXp(99999, 10), ErroConflito);
    assert.throws(() => m.servicoProgressao.aumentarAtributo(m.jogador.id, 'mana', 1), ErroValidacao);
    assert.equal(m.servicoProgressao.obter(m.jogador.id).xpTotal, 0);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F06 progressão | serviço | XP zero é neutro', () => {
  const m = mundo();
  try {
    const r = m.servicoProgressao.adicionarXp(m.jogador.id, 0);
    assert.equal(r.subiuNivel, false);
    assert.equal(m.servicoProgressao.obter(m.jogador.id).xpTotal, 0);
  } finally {
    destruirBancoTemporario(m);
  }
});
