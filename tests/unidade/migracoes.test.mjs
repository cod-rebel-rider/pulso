/**
 * Testes unitários — sistema de migrações (Fase 02 — Banco de Dados)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirConexao, fecharConexao } from '../../src/core/database/conexao.js';
import { aplicarMigracoes, versaoAtual, MIGRACOES } from '../../src/core/database/migracoes.js';

test('banco vazio recebe as migrações oficiais: schema v4 com infraestrutura, jogador, status e missões', () => {
  const banco = abrirConexao({ caminho: ':memory:' });
  try {
    const resultado = aplicarMigracoes(banco);
    assert.deepEqual(resultado.aplicadas, [
      { versao: 1, nome: 'criar-infraestrutura-base' },
      { versao: 2, nome: 'criar-tabela-jogador' },
      { versao: 3, nome: 'criar-tabela-status' },
      { versao: 4, nome: 'criar-tabela-missoes' },
    ]);
    assert.equal(resultado.versaoAtual, 4);
    assert.equal(versaoAtual(banco), 4);

    assert.equal(banco.prepare("SELECT valor FROM meta WHERE chave = 'aplicacao'").get().valor, 'PULSO');
    // a tabela do jogador existe e aceita inserção mínima
    banco.prepare("INSERT INTO jogador (nome) VALUES ('Teste')").run();
    assert.equal(banco.prepare('SELECT COUNT(*) AS n FROM jogador').get().n, 1);
    // a tabela de status existe e aceita inserção mínima
    banco.prepare("INSERT INTO jogador_status (jogador_id, energia, foco, estresse, criatividade) VALUES (1, 100, 100, 0, 100)").run();
    assert.equal(banco.prepare('SELECT COUNT(*) AS n FROM jogador_status').get().n, 1);
    // a tabela de missões existe e aceita inserção mínima
    banco.prepare("INSERT INTO missao (jogador_id, titulo, estado, prioridade) VALUES (1, 'Teste', 'pendente', 'normal')").run();
    assert.equal(banco.prepare('SELECT COUNT(*) AS n FROM missao').get().n, 1);
  } finally {
    fecharConexao(banco);
  }
});

test('migrações já aplicadas não são executadas novamente', () => {
  const banco = abrirConexao({ caminho: ':memory:' });
  try {
    aplicarMigracoes(banco);
    const registroOriginal = banco
      .prepare('SELECT aplicada_em FROM schema_migrations WHERE versao = 1')
      .get();

    const segundaExecucao = aplicarMigracoes(banco);
    assert.deepEqual(segundaExecucao.aplicadas, [], 'nenhuma migração deveria rodar de novo');

    const registroDepois = banco
      .prepare('SELECT aplicada_em FROM schema_migrations WHERE versao = 1')
      .get();
    assert.equal(registroDepois.aplicada_em, registroOriginal.aplicada_em, 'registro inalterado');
    assert.equal(
      banco.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,
      4,
      'todas as migrações oficiais (001, 002, 003 e 004) registradas uma única vez',
    );
  } finally {
    fecharConexao(banco);
  }
});

test('migração pendente é executada quando o banco já existe (evolução)', () => {
  const banco = abrirConexao({ caminho: ':memory:' });
  try {
    const m1 = MIGRACOES[0];
    aplicarMigracoes(banco, [m1]);

    const m2 = {
      versao: 2,
      nome: 'teste-migracao-pendente',
      cima(db) {
        db.exec('CREATE TABLE pendente_teste (id INTEGER PRIMARY KEY) STRICT');
      },
    };
    const resultado = aplicarMigracoes(banco, [m1, m2]);
    assert.deepEqual(resultado.aplicadas, [{ versao: 2, nome: 'teste-migracao-pendente' }]);
    assert.equal(versaoAtual(banco), 2);
    banco.prepare('INSERT INTO pendente_teste (id) VALUES (1)').run(); // tabela existe
  } finally {
    fecharConexao(banco);
  }
});

test('falha de migração reverte a transação e produz erro identificável', () => {
  const banco = abrirConexao({ caminho: ':memory:' });
  try {
    const m1 = MIGRACOES[0];
    const mRuim = {
      versao: 2,
      nome: 'migracao-que-falha',
      cima(db) {
        db.exec('CREATE TABLE antes_da_falha (id INTEGER PRIMARY KEY) STRICT');
        db.exec('INSERT INTO tabela_que_nao_existe VALUES (1)'); // provoca o erro
      },
    };

    assert.throws(
      () => aplicarMigracoes(banco, [m1, mRuim]),
      /Falha na migração 2 \(migracao-que-falha\) — transação revertida/,
    );

    const tabelaRevertida = banco
      .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'antes_da_falha'")
      .get().n;
    assert.equal(tabelaRevertida, 0, 'DDL executado antes da falha deve ser revertido');
    assert.equal(versaoAtual(banco), 1, 'migração falha não pode ficar registrada');
  } finally {
    fecharConexao(banco);
  }
});

test('lista de migrações inválida é rejeitada antes de tocar no banco', () => {
  const banco = abrirConexao({ caminho: ':memory:' });
  try {
    assert.throws(
      () =>
        aplicarMigracoes(banco, [
          { versao: 1, nome: 'a', cima() {} },
          { versao: 1, nome: 'b', cima() {} },
        ]),
      /sequência sem lacunas/,
    );
    assert.throws(
      () => aplicarMigracoes(banco, [{ versao: 2, nome: 'pula-a-versao-1', cima() {} }]),
      /sequência sem lacunas/,
    );
    assert.throws(
      () => aplicarMigracoes(banco, [{ versao: 1, nome: 'Nome Invalido', cima() {} }]),
      /nome inválido/,
    );
  } finally {
    fecharConexao(banco);
  }
});
