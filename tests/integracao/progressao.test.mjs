/**
 * PULSO — Testes de integração: Progressão (Fase 06)
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { aplicarMigracoes } from '../../src/core/database/migracoes.js';
import { RepositorioJogador } from '../../src/core/database/repositorios/jogador.js';
import { RepositorioProgressao } from '../../src/core/database/repositorios/progressao.js';
import { RepositorioAtributos } from '../../src/core/database/repositorios/atributos.js';
import { ServicoProgressao } from '../../src/core/aplicacao/servico-progressao.js';
import { ServicoJogador } from '../../src/core/aplicacao/servico-jogador.js';
import { ErroValidacao, ErroConflito } from '../../src/core/erros.js';

let diretorio;
let banco;
let servicoJogador;
let servicoProgressao;
let jogador;

before(() => {
  diretorio = mkdtempSync(join(tmpdir(), 'pulso-progressao-'));
  banco = new DatabaseSync(join(diretorio, 'pulso.db'));
  banco.exec('PRAGMA foreign_keys = ON');
  aplicarMigracoes(banco);
  const repoJogador = new RepositorioJogador(banco);
  const repoProgressao = new RepositorioProgressao(banco);
  const repoAtributos = new RepositorioAtributos(banco);
  servicoProgressao = new ServicoProgressao({
    repositorioProgressao: repoProgressao,
    repositorioAtributos: repoAtributos,
    repositorioJogador: repoJogador,
    banco,
  });
  servicoJogador = new ServicoJogador({
    repositorio: repoJogador,
    banco,
    aoCriar: (j) => servicoProgressao.criarInicial(j.id),
  });
  jogador = servicoJogador.criar({ nome: 'Teste', codinome: 'prog' });
});

after(() => {
  banco.close();
  rmSync(diretorio, { recursive: true, force: true });
});

test('jogador novo começa no nível 1, 0 XP, 0 pontos, atributos em 1', () => {
  const visao = servicoProgressao.obter(jogador.id);
  assert.equal(visao.nivel, 1);
  assert.equal(visao.xpTotal, 0);
  assert.equal(visao.pontosDisponiveis, 0);
  assert.deepEqual(visao.atributos, {
    tecnologia: 1, criatividade: 1, musica: 1, social: 1, energia: 1, foco: 1, disciplina: 1,
  });
  assert.equal(visao.xpNoNivel, 0);
  assert.equal(visao.xpNecessario, 100);
});

test('adicionar XP positivo persiste e detalha progresso', () => {
  const r = servicoProgressao.adicionarXp(jogador.id, 75);
  assert.equal(r.xpTotal, 75);
  assert.equal(r.nivel, 1);
  assert.equal(r.subiuNivel, false);
  const relido = servicoProgressao.obter(jogador.id);
  assert.equal(relido.xpTotal, 75);
});

test('level up no limite concede ponto; múltiplos ganhos acumulam', () => {
  servicoProgressao.adicionarXp(jogador.id, 25);
  const aposNivel2 = servicoProgressao.obter(jogador.id);
  assert.equal(aposNivel2.nivel, 2);
  assert.equal(aposNivel2.pontosDisponiveis, 1);
});

test('rejeita XP negativo e jogador inexistente', () => {
  assert.throws(() => servicoProgressao.adicionarXp(jogador.id, -5), ErroValidacao);
  assert.throws(() => servicoProgressao.obter(99999), ErroConflito);
  assert.throws(() => servicoProgressao.adicionarXp(99999, 10), ErroConflito);
});

test('distribui pontos e persiste; excesso bloqueado', () => {
  const antes = servicoProgressao.obter(jogador.id);
  assert.ok(antes.pontosDisponiveis >= 1);
  const depois = servicoProgressao.aumentarAtributo(jogador.id, 'tecnologia', 1);
  assert.equal(depois.atributos.tecnologia, antes.atributos.tecnologia + 1);
  assert.equal(depois.pontosDisponiveis, antes.pontosDisponiveis - 1);
  assert.throws(() => servicoProgressao.aumentarAtributo(jogador.id, 'foco', 99), ErroValidacao);
  assert.throws(() => servicoProgressao.aumentarAtributo(jogador.id, 'mana', 1), ErroValidacao);
});

test('integridade: jogador sem progressão é inicializado sem duplicar', () => {
  const direto = new RepositorioJogador(banco).criar({ nome: 'Orfao', codinome: null });
  const v1 = servicoProgressao.obter(direto.id);
  servicoProgressao.obter(direto.id);
  assert.equal(v1.nivel, 1);
  assert.equal(v1.xpTotal, 0);
  const total = banco.prepare('SELECT COUNT(*) AS n FROM jogador_progressao WHERE jogador_id = ?').get(direto.id).n;
  assert.equal(total, 1);
});

test('persistência: progressão sobrevive ao fechar e reabrir', () => {
  const estado = servicoProgressao.obter(jogador.id);
  banco.close();
  banco = new DatabaseSync(join(diretorio, 'pulso.db'));
  banco.exec('PRAGMA foreign_keys = ON');
  const repoJogador = new RepositorioJogador(banco);
  const servico2 = new ServicoProgressao({
    repositorioProgressao: new RepositorioProgressao(banco),
    repositorioAtributos: new RepositorioAtributos(banco),
    repositorioJogador: repoJogador,
    banco,
  });
  const relido = servico2.obter(jogador.id);
  assert.equal(relido.xpTotal, estado.xpTotal);
  assert.equal(relido.nivel, estado.nivel);
  assert.deepEqual(relido.atributos, estado.atributos);
});
