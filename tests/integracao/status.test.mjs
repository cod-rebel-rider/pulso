/**
 * PULSO — Testes de integração: Status (Fase 04)
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
import { RepositorioStatus } from '../../src/core/database/repositorios/status.js';
import { ServicoStatus } from '../../src/core/aplicacao/servico-status.js';
import { ServicoJogador } from '../../src/core/aplicacao/servico-jogador.js';
import { comTransacao } from '../../src/core/database/transacao.js';
import { ErroValidacao, ErroConflito } from '../../src/core/erros.js';

let diretorio;
let banco;
let repositorioJogador;
let repositorioStatus;
let servicoStatus;
let servicoJogador;

before(() => {
  diretorio = mkdtempSync(join(tmpdir(), 'pulso-status-teste-'));
  banco = new DatabaseSync(join(diretorio, 'pulso.db'));
  aplicarMigracoes(banco);

  repositorioJogador = new RepositorioJogador(banco);
  repositorioStatus = new RepositorioStatus(banco);
  servicoStatus = new ServicoStatus({ repositorio: repositorioStatus, repositorioJogador });
  servicoJogador = new ServicoJogador({
    repositorio: repositorioJogador,
    banco,
    aoCriar: (jogador) => servicoStatus.criarInicial(jogador.id),
  });
});

after(() => {
  banco.close();
  rmSync(diretorio, { recursive: true, force: true });
});

function criarJogadorTeste(nome = 'Teste', codinome = 'operador') {
  return comTransacao(banco, () => {
    const jogador = repositorioJogador.criar({ nome, codinome });
    repositorioStatus.criar(jogador.id, { energia: 100, foco: 100, estresse: 0, criatividade: 100 });
    return jogador;
  });
}

test('criação do jogador também cria status inicial (transação)', () => {
  const jogador = servicoJogador.criar({ nome: 'Ana', codinome: 'prime' });
  assert.ok(jogador.id);
  const status = servicoStatus.obter(jogador.id);
  assert.deepEqual(
    { energia: status.energia, foco: status.foco, estresse: status.estresse, criatividade: status.criatividade },
    { energia: 100, foco: 100, estresse: 0, criatividade: 100 },
  );
});

test('obter retorna status existente sem duplicar', () => {
  const jogador = criarJogadorTeste();
  const status1 = servicoStatus.obter(jogador.id);
  const status2 = servicoStatus.obter(jogador.id);
  assert.equal(status1.id, status2.id);
  assert.equal(repositorioStatus.existe(jogador.id), true);
});

test('alterar energia dentro da faixa', () => {
  const jogador = criarJogadorTeste();
  const status = servicoStatus.alterar(jogador.id, 'energia', -25);
  assert.equal(status.energia, 75);
});

test('alterar limita ao teto (100)', () => {
  const jogador = criarJogadorTeste();
  const status = servicoStatus.alterar(jogador.id, 'energia', 50);
  assert.equal(status.energia, 100);
});

test('alterar limita ao piso (0)', () => {
  const jogador = criarJogadorTeste();
  const status = servicoStatus.alterar(jogador.id, 'foco', -200);
  assert.equal(status.foco, 0);
});

test('alterar estresse e criatividade', () => {
  const jogador = criarJogadorTeste();
  const s1 = servicoStatus.alterar(jogador.id, 'estresse', 30);
  assert.equal(s1.estresse, 30);
  const s2 = servicoStatus.alterar(jogador.id, 'criatividade', -40);
  assert.equal(s2.criatividade, 60);
});

test('alterar rejeita status desconhecido', () => {
  const jogador = criarJogadorTeste();
  assert.throws(() => servicoStatus.alterar(jogador.id, 'mana', 10), ErroValidacao);
});

test('alterar rejeita delta inválido', () => {
  const jogador = criarJogadorTeste();
  assert.throws(() => servicoStatus.alterar(jogador.id, 'energia', 'dez'), ErroValidacao);
});

test('obter rejeita jogador inexistente', () => {
  assert.throws(() => servicoStatus.obter(99999), ErroConflito);
});

test('updated_at muda após alteração', async () => {
  const jogador = criarJogadorTeste();
  const antes = servicoStatus.obter(jogador.id).atualizadoEm;
  await new Promise((r) => setTimeout(r, 10)); // garante diferença no carimbo
  const depois = servicoStatus.alterar(jogador.id, 'energia', -5).atualizadoEm;
  assert.notEqual(antes, depois);
});

test('persistência: status sobrevive ao fechar/reabrir banco', () => {
  const jogador = criarJogadorTeste('Persistência', 'persist');
  servicoStatus.alterar(jogador.id, 'energia', -30);
  servicoStatus.alterar(jogador.id, 'estresse', 20);

  // Fecha e reabre a conexão
  banco.close();
  banco = new DatabaseSync(join(diretorio, 'pulso.db'));
  const repoStatus2 = new RepositorioStatus(banco);
  const servico2 = new ServicoStatus({
    repositorio: repoStatus2,
    repositorioJogador: new RepositorioJogador(banco),
  });

  const status = servico2.obter(jogador.id);
  assert.equal(status.energia, 70);
  assert.equal(status.estresse, 20);
});
