/**
 * PULSO — Testes unitários: serviço de Progressão (Fase 06)
 *
 * Serviço em ISOLAMENTO: repositórios fake em memória e banco fake que apenas
 * registra os comandos de transação. Valida orquestração, contrato de retorno
 * e uso de transações sem depender do SQLite — o caminho com banco real está
 * em tests/integracao/progressao.test.mjs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServicoProgressao } from '../../src/core/aplicacao/servico-progressao.js';
import { ErroValidacao, ErroConflito } from '../../src/core/erros.js';

const JOGADOR = Object.freeze({ id: 1, nome: 'Fake', codinome: null });
const ATRIBUTOS_INICIAIS_FAKE = Object.freeze({
  tecnologia: 1, criatividade: 1, musica: 1, social: 1, energia: 1, foco: 1, disciplina: 1,
});

/** Banco fake: só registra os comandos de transação (BEGIN/COMMIT/ROLLBACK). */
function criarBancoFake() {
  const comandos = [];
  return { comandos, exec: (sql) => comandos.push(sql) };
}

function criarRepositorioJogadorFake() {
  return { buscarPorId: (id) => (id === JOGADOR.id ? JOGADOR : null) };
}

function criarProgressaoFake(registro = null) {
  const estado = { registro, criacoes: 0, atualizacoes: 0, falharEm: null };
  const carimbo = { criadoEm: 'criado', atualizadoEm: 'atualizado' };
  return {
    estado,
    criar(jogadorId, { xpTotal, nivel, pontosDisponiveis }) {
      estado.criacoes += 1;
      estado.registro = { id: 1, jogadorId, xpTotal, nivel, pontosDisponiveis, ...carimbo };
      return estado.registro;
    },
    buscarPorJogador() {
      return estado.registro;
    },
    atualizar(jogadorId, { xpTotal, nivel, pontosDisponiveis }) {
      if (estado.falharEm === 'atualizar') throw new Error('falha simulada na progressão');
      estado.atualizacoes += 1;
      estado.registro = { ...estado.registro, xpTotal, nivel, pontosDisponiveis };
      return estado.registro;
    },
    existe() {
      return estado.registro !== null;
    },
  };
}

function criarAtributosFake(registro = null) {
  const estado = { registro, criacoes: 0, atualizacoes: 0, falharEm: null };
  const carimbo = { criadoEm: 'criado', atualizadoEm: 'atualizado' };
  return {
    estado,
    criar(jogadorId, valores) {
      if (estado.falharEm === 'criar') throw new Error('falha simulada nos atributos');
      estado.criacoes += 1;
      estado.registro = { id: 1, jogadorId, ...valores, ...carimbo };
      return estado.registro;
    },
    buscarPorJogador() {
      return estado.registro;
    },
    atualizar(jogadorId, valores) {
      if (estado.falharEm === 'atualizar') throw new Error('falha simulada nos atributos');
      estado.atualizacoes += 1;
      estado.registro = { ...estado.registro, ...valores };
      return estado.registro;
    },
    existe() {
      return estado.registro !== null;
    },
  };
}

/** Monta o serviço com fakes e devolve tudo o que as asserções precisam. */
function montarServico({ progressao = null, atributos = null, banco = null } = {}) {
  const repositorioProgressao = criarProgressaoFake(progressao);
  const repositorioAtributos = criarAtributosFake(atributos);
  const servico = new ServicoProgressao({
    repositorioProgressao,
    repositorioAtributos,
    repositorioJogador: criarRepositorioJogadorFake(),
    banco,
  });
  return { servico, repositorioProgressao, repositorioAtributos };
}

/** Progressão/atributos já existentes (jogador ativo). */
function registroExistente(extra = {}) {
  return {
    progressao: {
      id: 1, jogadorId: 1, xpTotal: 0, nivel: 1, pontosDisponiveis: 0,
      criadoEm: 'criado', atualizadoEm: 'atualizado', ...extra.progressao,
    },
    atributos: {
      id: 1, jogadorId: 1, ...ATRIBUTOS_INICIAIS_FAKE,
      criadoEm: 'criado', atualizadoEm: 'atualizado', ...extra.atributos,
    },
  };
}

// ── Criação / consulta ────────────────────────────────────────────────

test('obter: jogador novo inicializa progressão e atributos numa transação', () => {
  const banco = criarBancoFake();
  const { servico, repositorioProgressao, repositorioAtributos } = montarServico({ banco });

  const visao = servico.obter(JOGADOR.id);

  assert.equal(visao.jogadorId, JOGADOR.id);
  assert.equal(visao.xpTotal, 0);
  assert.equal(visao.nivel, 1);
  assert.equal(visao.pontosDisponiveis, 0);
  assert.deepEqual(visao.atributos, ATRIBUTOS_INICIAIS_FAKE);
  assert.equal(visao.xpNoNivel, 0);
  assert.equal(visao.xpNecessario, 100);
  assert.equal(visao.progresso, 0);
  assert.equal(visao.subiuNivel, false);
  assert.equal(visao.niveisGanhos, 0);
  assert.equal(Object.isFrozen(visao), true);
  assert.equal(Object.isFrozen(visao.atributos), true);
  assert.equal(repositorioProgressao.estado.criacoes, 1);
  assert.equal(repositorioAtributos.estado.criacoes, 1);
  assert.deepEqual(banco.comandos, ['BEGIN IMMEDIATE', 'COMMIT']);
});

test('obter: idempotente — a segunda chamada não recria nada nem abre transação', () => {
  const banco = criarBancoFake();
  const { servico, repositorioProgressao, repositorioAtributos } = montarServico({ banco });
  servico.obter(JOGADOR.id);
  banco.comandos.length = 0;

  servico.obter(JOGADOR.id);

  assert.equal(repositorioProgressao.estado.criacoes, 1);
  assert.equal(repositorioAtributos.estado.criacoes, 1);
  assert.deepEqual(banco.comandos, []);
});

test('obter: repara só o lado ausente sem duplicar o que já existe', () => {
  const banco = criarBancoFake();
  const { progressao } = registroExistente({ progressao: { xpTotal: 250, nivel: 2, pontosDisponiveis: 1 } });
  const { servico, repositorioProgressao, repositorioAtributos } = montarServico({ progressao, banco });

  const visao = servico.obter(JOGADOR.id);

  assert.equal(repositorioProgressao.estado.criacoes, 0);
  assert.equal(repositorioAtributos.estado.criacoes, 1);
  assert.equal(visao.xpTotal, 250);
  assert.equal(visao.nivel, 2);
  assert.deepEqual(banco.comandos, ['BEGIN IMMEDIATE', 'COMMIT']);
});

test('criarInicial é idempotente em chamadas repetidas', () => {
  const { servico, repositorioProgressao, repositorioAtributos } = montarServico();
  servico.criarInicial(JOGADOR.id);
  servico.criarInicial(JOGADOR.id);
  assert.equal(repositorioProgressao.estado.criacoes, 1);
  assert.equal(repositorioAtributos.estado.criacoes, 1);
});

test('jogador inexistente: ErroConflito em todas as operações', () => {
  const { servico } = montarServico({ banco: criarBancoFake() });
  assert.throws(() => servico.obter(999), ErroConflito);
  assert.throws(() => servico.adicionarXp(999, 10), ErroConflito);
  assert.throws(() => servico.aumentarAtributo(999, 'tecnologia', 1), ErroConflito);
});

// ── XP ────────────────────────────────────────────────────────────────

test('contrato uniforme: as três operações devolvem a mesma forma congelada', () => {
  const { servico } = montarServico({ banco: criarBancoFake() });
  const consulta = servico.obter(JOGADOR.id);
  const xp = servico.adicionarXp(JOGADOR.id, 100, 'MISSAO');
  const atributo = servico.aumentarAtributo(JOGADOR.id, 'tecnologia', 1);

  const chaves = (visao) => Object.keys(visao).sort();
  assert.deepEqual(chaves(xp), chaves(consulta));
  assert.deepEqual(chaves(atributo), chaves(consulta));
  for (const visao of [consulta, xp, atributo]) {
    assert.equal(Object.isFrozen(visao), true);
    assert.equal(typeof visao.subiuNivel, 'boolean');
    assert.equal(typeof visao.niveisGanhos, 'number');
  }
  assert.equal(xp.subiuNivel, true);
  assert.equal(xp.niveisGanhos, 1);
  assert.equal(atributo.subiuNivel, false);
  assert.equal(atributo.niveisGanhos, 0);
});

test('adicionarXp: zero não escreve, não abre transação e mantém os sinalizadores', () => {
  const banco = criarBancoFake();
  const registro = registroExistente({ progressao: { xpTotal: 90 } });
  const { servico, repositorioProgressao } = montarServico({ ...registro, banco });

  const visao = servico.adicionarXp(JOGADOR.id, 0);

  assert.equal(visao.xpTotal, 90);
  assert.equal(visao.nivel, 1);
  assert.equal(visao.subiuNivel, false);
  assert.equal(visao.niveisGanhos, 0);
  assert.equal(repositorioProgressao.estado.atualizacoes, 0);
  assert.deepEqual(banco.comandos, []);
});

test('adicionarXp: level up concede ponto e persiste numa transação', () => {
  const banco = criarBancoFake();
  const registro = registroExistente({ progressao: { xpTotal: 90 } });
  const { servico, repositorioProgressao } = montarServico({ ...registro, banco });

  const visao = servico.adicionarXp(JOGADOR.id, 20, 'PROJETO');

  assert.equal(visao.xpTotal, 110);
  assert.equal(visao.nivel, 2);
  assert.equal(visao.pontosDisponiveis, 1);
  assert.equal(visao.subiuNivel, true);
  assert.equal(visao.niveisGanhos, 1);
  assert.equal(visao.xpNoNivel, 10);
  assert.equal(visao.xpNecessario, 200);
  assert.equal(repositorioProgressao.estado.atualizacoes, 1);
  assert.deepEqual(banco.comandos, ['BEGIN IMMEDIATE', 'COMMIT']);
});

test('validações rejeitam antes de qualquer escrita', () => {
  const banco = criarBancoFake();
  const registro = registroExistente();
  const { servico, repositorioProgressao, repositorioAtributos } = montarServico({ ...registro, banco });

  assert.throws(() => servico.adicionarXp(JOGADOR.id, -5), ErroValidacao);
  assert.throws(() => servico.adicionarXp(JOGADOR.id, 1.5), ErroValidacao);
  assert.throws(() => servico.adicionarXp(JOGADOR.id, 10, 'LOJA'), ErroValidacao);
  assert.throws(() => servico.adicionarXp(JOGADOR.id, 10, 'missao'), ErroValidacao);
  assert.throws(() => servico.aumentarAtributo(JOGADOR.id, 'mana', 1), ErroValidacao);
  assert.throws(() => servico.aumentarAtributo(JOGADOR.id, 'tecnologia', 1), ErroValidacao); // sem pontos
  assert.throws(() => servico.aumentarAtributo(JOGADOR.id, 'tecnologia', 0), ErroValidacao);

  assert.equal(repositorioProgressao.estado.atualizacoes, 0);
  assert.equal(repositorioAtributos.estado.atualizacoes, 0);
  assert.deepEqual(banco.comandos, []);
});

// ── Atributos e transações ────────────────────────────────────────────

test('aumentarAtributo: teto do domínio vale na aplicação e a escrita é atômica', () => {
  const banco = criarBancoFake();
  const registro = registroExistente({
    progressao: { pontosDisponiveis: 10 },
    atributos: { tecnologia: 95 },
  });
  const { servico, repositorioProgressao, repositorioAtributos } = montarServico({ ...registro, banco });

  assert.throws(() => servico.aumentarAtributo(JOGADOR.id, 'tecnologia', 6), ErroValidacao);
  assert.deepEqual(banco.comandos, []);

  const visao = servico.aumentarAtributo(JOGADOR.id, 'tecnologia', 5);

  assert.equal(visao.atributos.tecnologia, 100);
  assert.equal(visao.pontosDisponiveis, 5);
  assert.equal(repositorioAtributos.estado.atualizacoes, 1);
  assert.equal(repositorioProgressao.estado.atualizacoes, 1);
  assert.deepEqual(banco.comandos, ['BEGIN IMMEDIATE', 'COMMIT']);
});

test('falha na escrita reverte a transação e propaga o erro', () => {
  const banco = criarBancoFake();
  const registro = registroExistente();
  const { servico, repositorioProgressao } = montarServico({ ...registro, banco });
  repositorioProgressao.estado.falharEm = 'atualizar';

  assert.throws(() => servico.adicionarXp(JOGADOR.id, 50), /falha simulada/);
  assert.deepEqual(banco.comandos, ['BEGIN IMMEDIATE', 'ROLLBACK']);
});

test('reparo: falha ao criar os atributos reverte tudo (nada fica parcial)', () => {
  const banco = criarBancoFake();
  const { servico, repositorioAtributos } = montarServico({ banco });
  repositorioAtributos.estado.falharEm = 'criar';

  assert.throws(() => servico.obter(JOGADOR.id), /falha simulada/);
  assert.deepEqual(banco.comandos, ['BEGIN IMMEDIATE', 'ROLLBACK']);
});

test('sem banco (modo degradado) as operações continuam funcionando', () => {
  const { servico } = montarServico();
  const visao = servico.adicionarXp(JOGADOR.id, 100, 'CONQUISTA');
  assert.equal(visao.nivel, 2);
  assert.equal(visao.subiuNivel, true);
});

