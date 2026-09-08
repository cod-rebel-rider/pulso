/**
 * Testes unitários — conexão SQLite (Fase 02 — Banco de Dados)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirConexao, fecharConexao, verificarIntegridade } from '../../src/core/database/conexao.js';

function criarDiretorioTemporario() {
  return mkdtempSync(join(tmpdir(), 'pulso-conexao-'));
}

test('conexão abre com PRAGMAs de integridade e desempenho configurados', () => {
  const diretorio = criarDiretorioTemporario();
  try {
    const banco = abrirConexao({ caminho: join(diretorio, 'pragmas.db') });
    try {
      assert.equal(banco.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, 'foreign keys ON');
      assert.equal(banco.prepare('PRAGMA journal_mode').get().journal_mode, 'wal', 'journal_mode WAL');
      // leitura agnóstica ao nome da coluna do PRAGMA (varia entre versões)
      const tempoEspera = Object.values(banco.prepare('PRAGMA busy_timeout').get())[0];
      assert.equal(Number(tempoEspera), 5000, 'busy_timeout 5 s');
      assert.equal(banco.prepare('PRAGMA synchronous').get().synchronous, 1, 'synchronous NORMAL');
    } finally {
      fecharConexao(banco);
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('conexão fechada não aceita mais comandos', () => {
  const banco = abrirConexao({ caminho: ':memory:' });
  fecharConexao(banco);
  assert.throws(() => banco.prepare('SELECT 1').get(), /not open|fechado/i);
});

test('verificarIntegridade aprova um banco saudável', () => {
  const banco = abrirConexao({ caminho: ':memory:' });
  try {
    banco.exec('CREATE TABLE sinal (id INTEGER PRIMARY KEY) STRICT');
    const integridade = verificarIntegridade(banco);
    assert.equal(integridade.ok, true, JSON.stringify(integridade.problemas));
  } finally {
    fecharConexao(banco);
  }
});

test('abertura somente leitura de banco inexistente falha de forma identificável', () => {
  assert.throws(
    () => abrirConexao({ caminho: '/tmp/pulso-inexistente-que-nao-existe.db', apenasLeitura: true }),
    /Não foi possível abrir o banco/,
  );
});
