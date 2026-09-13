/**
 * PULSO — Homologação FASE 07 — Projetos.
 * Estados, progresso derivado das missões, vínculo 1:N, bloqueios,
 * exclusão só de arquivado ou cancelado.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarTituloProjeto, validarPrioridadeProjeto } from '../../src/core/dominio/projeto.js';
import { transicaoProjetoPermitida, calcularProgressoProjeto } from '../../src/core/dominio/projeto.js';
import { ESTADOS_PROJETO } from '../../src/core/dominio/projeto.js';
import { ErroValidacao, ErroConflito, ErroTransicao } from '../../src/core/erros.js';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../utils/ambiente-homologacao.mjs';

function mundo() {
  const ambiente = criarBancoTemporario('homolog-f07-');
  const servicos = criarServicos(ambiente.banco);
  const jogador = servicos.servicoJogador.criar({ nome: 'Projetos' });
  return { ...ambiente, ...servicos, jogador };
}

test('F07 projetos | domínio | título e prioridade validados', () => {
  assert.equal(validarTituloProjeto(' Base Alpha '), 'Base Alpha');
  assert.throws(() => validarTituloProjeto(''), ErroValidacao);
  assert.throws(() => validarPrioridadeProjeto('mega'), ErroValidacao);
});

test('F07 projetos | domínio | máquina de estados correta', () => {
  assert.equal(transicaoProjetoPermitida(ESTADOS_PROJETO.PLANEJADO, ESTADOS_PROJETO.EM_ANDAMENTO), true);
  assert.equal(transicaoProjetoPermitida(ESTADOS_PROJETO.PLANEJADO, ESTADOS_PROJETO.CONCLUIDO), false);
  assert.equal(transicaoProjetoPermitida(ESTADOS_PROJETO.CONCLUIDO, ESTADOS_PROJETO.ARQUIVADO), true);
  assert.equal(transicaoProjetoPermitida(ESTADOS_PROJETO.ARQUIVADO, ESTADOS_PROJETO.EM_ANDAMENTO), false);
});

test('F07 projetos | domínio | progresso igual concluídas sobre total', () => {
  assert.equal(calcularProgressoProjeto([]), 0);
  assert.equal(calcularProgressoProjeto([{ estado: 'concluida' }, { estado: 'pendente' }]), 50);
  assert.equal(calcularProgressoProjeto([{ estado: 'concluida' }]), 100);
});

test('F07 projetos | serviço | criação planejada com 0 por cento', () => {
  const m = mundo();
  try {
    const p = m.servicoProjeto.criar(m.jogador.id, { titulo: 'OndaHub' });
    assert.equal(p.estado, 'planejado');
    assert.equal(p.progresso, 0);
    assert.throws(() => m.servicoProjeto.atualizar(p.id, { estado: 'concluido' }), ErroValidacao);
    assert.throws(() => m.servicoProjeto.criar(m.jogador.id, { titulo: '' }), ErroValidacao);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F07 projetos | serviço | fluxo planejado-andamento-concluído', () => {
  const m = mundo();
  try {
    const p = m.servicoProjeto.criar(m.jogador.id, { titulo: 'Ciclo' });
    assert.ok(m.servicoProjeto.iniciar(p.id).iniciadaEm);
    assert.equal(m.servicoProjeto.concluir(p.id).estado, 'concluido');
    assert.throws(() => m.servicoProjeto.iniciar(p.id), ErroTransicao);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F07 projetos | serviço | 100 por cento não conclui sozinho', () => {
  const m = mundo();
  try {
    const p = m.servicoProjeto.criar(m.jogador.id, { titulo: 'Manual' });
    const missao = m.servicoMissao.criar(m.jogador.id, { titulo: 'Única' });
    m.servicoProjeto.associarMissao(p.id, missao.id);
    m.servicoMissao.iniciar(missao.id);
    m.servicoMissao.concluir(missao.id);
    const projeto = m.servicoProjeto.obter(p.id);
    assert.equal(projeto.progresso, 100);
    assert.equal(projeto.estado, 'planejado');
    assert.equal(projeto.prontaParaEncerrar, true);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F07 projetos | serviço | missão em dois projetos bloqueada', () => {
  const m = mundo();
  try {
    const p1 = m.servicoProjeto.criar(m.jogador.id, { titulo: 'P1' });
    const p2 = m.servicoProjeto.criar(m.jogador.id, { titulo: 'P2' });
    const missao = m.servicoMissao.criar(m.jogador.id, { titulo: 'M' });
    m.servicoProjeto.associarMissao(p1.id, missao.id);
    assert.throws(() => m.servicoProjeto.associarMissao(p2.id, missao.id), ErroConflito);
    assert.equal(m.servicoProjeto.removerMissao(p1.id, missao.id).totalMissoes, 0);
    assert.equal(m.servicoMissao.obter(missao.id).projetoId, null);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F07 projetos | serviço | vínculo entre jogadores bloqueado', () => {
  const m = mundo();
  try {
    const outro = m.repositorioJogador.criar({ nome: 'Outro', codinome: null });
    const p = m.servicoProjeto.criar(m.jogador.id, { titulo: 'Meu' });
    const alheia = m.servicoMissao.criar(outro.id, { titulo: 'Alheia' });
    assert.throws(() => m.servicoProjeto.associarMissao(p.id, alheia.id), ErroConflito);
  } finally {
    destruirBancoTemporario(m);
  }
});

test('F07 projetos | serviço | exclusão física só de arquivado ou cancelado', () => {
  const m = mundo();
  try {
    const p = m.servicoProjeto.criar(m.jogador.id, { titulo: 'Ativo' });
    assert.throws(() => m.servicoProjeto.excluir(p.id), ErroValidacao);
    m.servicoProjeto.arquivar(p.id);
    m.servicoProjeto.excluir(p.id);
    assert.throws(() => m.servicoProjeto.obter(p.id), ErroConflito);
  } finally {
    destruirBancoTemporario(m);
  }
});
