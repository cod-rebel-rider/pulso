/**
 * PULSO — Homologação FASE 05 — Missões.
 * Criação, máquina de estados, bloqueios de terminal, persistência.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarTitulo, validarDescricao, validarPrioridade } from '../../src/core/dominio/missao.js';
import { validarPrazo, transicaoPermitida, ESTADOS } from '../../src/core/dominio/missao.js';
import { ErroValidacao, ErroTransicao, ErroConflito } from '../../src/core/erros.js';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../utils/ambiente-homologacao.mjs';

function mundo() {
  const ambiente = criarBancoTemporario('homolog-f05-');
  const servicos = criarServicos(ambiente.banco);
  const jogador = servicos.servicoJogador.criar({ nome: 'Missões' });
  return { ...ambiente, ...servicos, jogador };
}

test('F05 missões | domínio | título válido; vazio e maior que 120 rejeitados', () => {
  assert.equal(validarTitulo('  Caçar bugs  '), 'Caçar bugs');
  assert.throws(() => validarTitulo(''), ErroValidacao);
  assert.throws(() => validarTitulo('t'.repeat(121)), ErroValidacao);
  assert.equal(validarTitulo('t'.repeat(120)).length, 120);
});

test('F05 missões | domínio | descrição opcional; maior que 2000 rejeitada', () => {
  assert.equal(validarDescricao(null), null);
  assert.equal(validarDescricao(''), null);
  assert.throws(() => validarDescricao('d'.repeat(2001)), ErroValidacao);
  assert.throws(() => validarDescricao(123), ErroValidacao);
});

test('F05 missões | domínio | prioridade e prazo validados', () => {
  assert.equal(validarPrioridade('alta'), 'alta');
  assert.throws(() => validarPrioridade('urgente'), ErroValidacao);
  assert.equal(validarPrazo(null), null);
  assert.equal(typeof validarPrazo('2026-12-31'), 'string');
  assert.throws(() => validarPrazo('31/12/2026'), ErroValidacao);
});

test('F05 missões | domínio | máquina de estados: só transições legais', () => {
  assert.equal(transicaoPermitida(ESTADOS.PENDENTE, ESTADOS.EM_ANDAMENTO), true);
  assert.equal(transicaoPermitida(ESTADOS.PENDENTE, ESTADOS.CANCELADA), true);
  assert.equal(transicaoPermitida(ESTADOS.PENDENTE, ESTADOS.CONCLUIDA), false);
  assert.equal(transicaoPermitida(ESTADOS.EM_ANDAMENTO, ESTADOS.CONCLUIDA), true);
  assert.equal(transicaoPermitida(ESTADOS.CONCLUIDA, ESTADOS.EM_ANDAMENTO), false);
  assert.equal(transicaoPermitida(ESTADOS.CANCELADA, ESTADOS.PENDENTE), false);
});

test('F05 missões | serviço | ciclo feliz pendente-andamento-concluída', () => {
  const m = mundo();
  try {
    const criada = m.servicoMissao.criar(m.jogador.id, { titulo: 'Ciclo' });
    assert.equal(criada.estado, 'pendente');
    assert.ok(m.servicoMissao.iniciar(criada.id).iniciadaEm);
    const concluida = m.servicoMissao.concluir(criada.id);
    assert.equal(concluida.estado, 'concluida');
    assert.ok(concluida.concluidaEm);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F05 missões | serviço | pular direto para concluída é bloqueado', () => {
  const m = mundo();
  try {
    const missao = m.servicoMissao.criar(m.jogador.id, { titulo: 'Atalho' });
    assert.throws(() => m.servicoMissao.concluir(missao.id), ErroTransicao);
    assert.equal(m.servicoMissao.obter(missao.id).estado, 'pendente');
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F05 missões | serviço | terminal nunca reabre', () => {
  const m = mundo();
  try {
    const a = m.servicoMissao.criar(m.jogador.id, { titulo: 'A' });
    m.servicoMissao.iniciar(a.id);
    m.servicoMissao.concluir(a.id);
    assert.throws(() => m.servicoMissao.iniciar(a.id), ErroTransicao);
    const b = m.servicoMissao.criar(m.jogador.id, { titulo: 'B' });
    m.servicoMissao.cancelar(b.id);
    assert.throws(() => m.servicoMissao.iniciar(b.id), ErroTransicao);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F05 missões | serviço | terminal não edita nem exclui', () => {
  const m = mundo();
  try {
    const missao = m.servicoMissao.criar(m.jogador.id, { titulo: 'Histórico' });
    m.servicoMissao.iniciar(missao.id);
    m.servicoMissao.concluir(missao.id);
    assert.throws(() => m.servicoMissao.atualizar(missao.id, { titulo: 'Outro' }), ErroTransicao);
    assert.throws(() => m.servicoMissao.excluir(missao.id), ErroTransicao);
    assert.equal(m.servicoMissao.obter(missao.id).titulo, 'Histórico');
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F05 missões | serviço | pendente pode ser excluída; inexistente rejeitada', () => {
  const m = mundo();
  try {
    const p = m.servicoMissao.criar(m.jogador.id, { titulo: 'Descartável' });
    m.servicoMissao.excluir(p.id);
    assert.throws(() => m.servicoMissao.obter(p.id), ErroConflito);
    assert.throws(() => m.servicoMissao.obter(99999), ErroConflito);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F05 missões | validação | tipos incorretos rejeitados sem corromper', () => {
  const m = mundo();
  try {
    assert.throws(() => m.servicoMissao.criar(m.jogador.id, { titulo: null }), ErroValidacao);
    assert.throws(() => m.servicoMissao.criar('abc', { titulo: 'X' }), ErroValidacao);
    assert.throws(() => m.servicoMissao.criar(m.jogador.id, { titulo: 'X', prioridade: 'mega' }), ErroValidacao);
    assert.equal(m.servicoMissao.listar(m.jogador.id).length, 0);
  } finally {
    destruirBancoTemporario(m);
  }
});
