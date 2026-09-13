/**
 * PULSO — Homologação FASE 02 — Banco de Dados.
 * PRAGMAs, migrações (sequência, idempotência, rollback),
 * integridade e persistência fechar→reabrir. Banco temporário isolado.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { inicializarBanco } from '../../src/core/database/inicializar.js';
import { aplicarMigracoes, versaoAtual, MIGRACOES } from '../../src/core/database/migracoes.js';
import { abrirConexao, fecharConexao, verificarIntegridade } from '../../src/core/database/conexao.js';
import { criarBancoTemporario, destruirBancoTemporario } from '../utils/ambiente-homologacao.mjs';

test('F02 banco | migrações | lista oficial tem 7 versões sequenciais', () => {
  assert.equal(MIGRACOES.length, 7);
  MIGRACOES.forEach((migracao, indice) => {
    assert.equal(migracao.versao, indice + 1);
    assert.match(migracao.nome, /^[a-z0-9-]+$/);
    assert.equal(typeof migracao.cima, 'function');
  });
});

test('F02 banco | migrações | banco temporário chega à v7 com todas as tabelas', () => {
  const ambiente = criarBancoTemporario('homolog-f02-');
  try {
    assert.equal(versaoAtual(ambiente.banco), 7);
    const tabelas = new Set(
      ambiente.banco.prepare("SELECT name AS nome FROM sqlite_master WHERE type = 'table'").all().map((l) => l.nome),
    );
    for (const tabela of ['schema_migrations', 'meta', 'jogador', 'jogador_status', 'missao', 'jogador_progressao', 'jogador_atributos', 'projeto', 'carteira', 'transacao', 'orcamento']) {
      assert.ok(tabelas.has(tabela), `tabela ${tabela} deve existir`);
    }
  } finally {
    destruirBancoTemporario(ambiente);
  }
});

test('F02 banco | migrações | reaplicar é idempotente (não duplica)', () => {
  const ambiente = criarBancoTemporario('homolog-f02-idem-');
  try {
    const segunda = aplicarMigracoes(ambiente.banco);
    assert.deepEqual(segunda.aplicadas, []);
    assert.equal(versaoAtual(ambiente.banco), 7);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});

test('F02 banco | migrações | falha real reverte e identifica a migração', () => {
  const ambiente = criarBancoTemporario('homolog-f02-falha-');
  try {
    const quebrada = [
      ...MIGRACOES,
      { versao: 8, nome: 'migracao-quebrada-proposital', cima: (banco) => banco.exec('CREATE TABLE homolog_quebrada (id INTEGER PRIMARY KEY); INSERT INTO homolog_quebrada (id) VALUES (1, 2);') },
    ];
    assert.throws(() => aplicarMigracoes(ambiente.banco, quebrada), /Falha na migração 8/);
    assert.equal(versaoAtual(ambiente.banco), 7, 'versão permanece 7 após rollback');
    const tabelas = new Set(
      ambiente.banco.prepare("SELECT name AS nome FROM sqlite_master WHERE type = 'table'").all().map((l) => l.nome),
    );
    assert.equal(tabelas.has('homolog_quebrada'), false, 'tabela parcial não pode restar após rollback');
  } finally {
    destruirBancoTemporario(ambiente);
  }
});

test('F02 banco | conexão | PRAGMAs ativos (foreign_keys ON; WAL aplicado por abrirConexao)', () => {
  const ambiente = criarBancoTemporario('homolog-f02-pragma-');
  try {
    assert.equal(ambiente.banco.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    const viaHelper = abrirConexao({ caminho: `${ambiente.diretorio}/via-helper.db` });
    try {
      assert.equal(viaHelper.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
      assert.equal(viaHelper.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
      assert.equal(viaHelper.prepare('PRAGMA busy_timeout').get().timeout, 5000);
      assert.equal(viaHelper.prepare('PRAGMA synchronous').get().synchronous, 1);
    } finally {
      fecharConexao(viaHelper);
    }
  } finally {
    destruirBancoTemporario(ambiente);
  }
});

test('F02 banco | conexão | caminho ausente rejeitado; fechar null não lança', () => {
  assert.throws(() => abrirConexao({ caminho: '' }), /caminho do banco é obrigatório/);
  fecharConexao(null);
});

test('F02 banco | integridade | banco íntegro recém-migrado', () => {
  const ambiente = criarBancoTemporario('homolog-f02-integr-');
  try {
    const resultado = verificarIntegridade(ambiente.banco);
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.problemas, []);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});

test('F02 banco | inicializar | cria arquivo, migra e fecha com segurança', () => {
  const ambiente = criarBancoTemporario('homolog-f02-init-');
  const { diretorio } = ambiente;
  destruirBancoTemporario(ambiente);
  const estado = inicializarBanco({ diretorioDados: diretorio, nomeArquivo: 'pulso.db' });
  try {
    assert.equal(estado.versaoSchema, 7);
    assert.equal(estado.migracoesAplicadas.length, 7);
  } finally {
    estado.fechar();
  }
  rmSync(diretorio, { recursive: true, force: true });
});

test('F02 banco | persistência | escrita sobrevive a fechar→reabrir', () => {
  const ambiente = criarBancoTemporario('homolog-f02-persist-');
  try {
    ambiente.banco.prepare("INSERT INTO meta (chave, valor) VALUES ('homolog', 'ok')").run();
    const caminho = join(ambiente.diretorio, 'pulso.db');
    ambiente.banco.close();
    const reaberto = new DatabaseSync(caminho);
    try {
      reaberto.exec('PRAGMA foreign_keys = ON');
      assert.equal(reaberto.prepare("SELECT valor FROM meta WHERE chave = 'homolog'").get().valor, 'ok');
    } finally {
      reaberto.close();
    }
    ambiente.banco = new DatabaseSync(caminho);
  } finally {
    destruirBancoTemporario(ambiente);
  }
});

test('F02 banco | integridade | FK real: missão exige jogador existente', () => {
  const ambiente = criarBancoTemporario('homolog-f02-fk-');
  try {
    assert.throws(() =>
      ambiente.banco.prepare("INSERT INTO missao (jogador_id, titulo) VALUES (99999, 'órfã')").run(),
    );
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
