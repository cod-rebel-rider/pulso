/**
 * PULSO — Testes de integração: Missões (Fase 05)
 *
 * Validam repositório + serviço com banco SQLite temporário (isolado).
 * Usa o runtime do Electron (Node ≥22.5) por causa do node:sqlite.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { aplicarMigracoes } from '../../src/core/database/migracoes.js';
import { RepositorioJogador } from '../../src/core/database/repositorios/jogador.js';
import { RepositorioMissao } from '../../src/core/database/repositorios/missao.js';
import { ServicoMissao } from '../../src/core/aplicacao/servico-missao.js';
import { ServicoJogador } from '../../src/core/aplicacao/servico-jogador.js';
import { ErroValidacao, ErroTransicao, ErroConflito } from '../../src/core/erros.js';

let diretorio;
let banco;
let repositorioJogador;
let repositorioMissao;
let servicoMissao;
let servicoJogador;
let jogadorTeste;

before(() => {
  diretorio = mkdtempSync(join(tmpdir(), 'pulso-missao-teste-'));
  banco = new DatabaseSync(join(diretorio, 'pulso.db'));
  aplicarMigracoes(banco);

  repositorioJogador = new RepositorioJogador(banco);
  repositorioMissao = new RepositorioMissao(banco);
  servicoJogador = new ServicoJogador({ repositorio: repositorioJogador, banco });
  servicoMissao = new ServicoMissao({ repositorio: repositorioMissao, repositorioJogador });
  jogadorTeste = servicoJogador.criar({ nome: 'Teste', codinome: 'operador' });
});

after(() => {
  banco.close();
  rmSync(diretorio, { recursive: true, force: true });
});

test('criar missão válida', () => {
  const missao = servicoMissao.criar(jogadorTeste.id, { titulo: 'Nova missão' });
  assert.ok(missao.id);
  assert.equal(missao.titulo, 'Nova missão');
  assert.equal(missao.estado, 'pendente');
  assert.equal(missao.prioridade, 'normal');
});

test('criar missão rejeita título vazio', () => {
  assert.throws(() => servicoMissao.criar(jogadorTeste.id, { titulo: '' }), ErroValidacao);
});

test('obter missão por id', () => {
  const criada = servicoMissao.criar(jogadorTeste.id, { titulo: 'Buscar por id' });
  const obtida = servicoMissao.obter(criada.id);
  assert.equal(obtida.id, criada.id);
  assert.equal(obtida.titulo, 'Buscar por id');
});

test('listar missões do jogador', () => {
  // Usa o jogadorTeste criado no before() — single-player não permite outro
  servicoMissao.criar(jogadorTeste.id, { titulo: 'Missão 1' });
  servicoMissao.criar(jogadorTeste.id, { titulo: 'Missão 2' });
  servicoMissao.criar(jogadorTeste.id, { titulo: 'Missão 3' });
  const missoes = servicoMissao.listar(jogadorTeste.id);
  assert.ok(missoes.length >= 3); // pode haver missões de testes anteriores
});

test('iniciar missão: pendente → em_andamento', () => {
  const missao = servicoMissao.criar(jogadorTeste.id, { titulo: 'Iniciar' });
  const iniciada = servicoMissao.iniciar(missao.id);
  assert.equal(iniciada.estado, 'em_andamento');
  assert.ok(iniciada.iniciadaEm);
});

test('concluir missão: em_andamento → concluida', () => {
  const missao = servicoMissao.criar(jogadorTeste.id, { titulo: 'Concluir' });
  servicoMissao.iniciar(missao.id);
  const concluida = servicoMissao.concluir(missao.id);
  assert.equal(concluida.estado, 'concluida');
  assert.ok(concluida.concluidaEm);
});

test('cancelar missão pendente: pendente → cancelada', () => {
  const missao = servicoMissao.criar(jogadorTeste.id, { titulo: 'Cancelar pendente' });
  const cancelada = servicoMissao.cancelar(missao.id);
  assert.equal(cancelada.estado, 'cancelada');
  assert.ok(cancelada.canceladaEm);
});

test('cancelar missão em andamento: em_andamento → cancelada', () => {
  const missao = servicoMissao.criar(jogadorTeste.id, { titulo: 'Cancelar andamento' });
  servicoMissao.iniciar(missao.id);
  const cancelada = servicoMissao.cancelar(missao.id);
  assert.equal(cancelada.estado, 'cancelada');
});

test('bloquear transição inválida: pendente → concluida', () => {
  const missao = servicoMissao.criar(jogadorTeste.id, { titulo: 'Transição inválida' });
  assert.throws(() => servicoMissao.concluir(missao.id), ErroTransicao);
});

test('bloquear transição inválida: concluida → em_andamento', () => {
  const missao = servicoMissao.criar(jogadorTeste.id, { titulo: 'Não reabrir' });
  servicoMissao.iniciar(missao.id);
  servicoMissao.concluir(missao.id);
  assert.throws(() => servicoMissao.iniciar(missao.id), ErroTransicao);
});
