/**
 * PULSO — Homologação FASE 09 — Loja / Lista de Desejos (PENDENTE).
 * A Fase 09 não está implementada (roadmap: pendente). Este arquivo
 * registra a ausência de forma testável. Quando a Fase 09 nascer,
 * substituir por testes reais de itens, desejos e compras.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarBancoTemporario, destruirBancoTemporario } from '../utils/ambiente-homologacao.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('F09 loja | pendente | domínio da loja ainda não existe', () => {
  assert.equal(existsSync(join(raiz, 'src', 'core', 'dominio', 'loja.js')), false);
});

test('F09 loja | pendente | serviço da loja ainda não existe', () => {
  assert.equal(existsSync(join(raiz, 'src', 'core', 'aplicacao', 'servico-loja.js')), false);
});

test('F09 loja | pendente | sem tabela de loja no schema v7', () => {
  const ambiente = criarBancoTemporario('homolog-f09-');
  try {
    const tabelas = new Set(
      ambiente.banco.prepare("SELECT name AS nome FROM sqlite_master WHERE type = 'table'").all().map((l) => l.nome),
    );
    assert.ok(!tabelas.has('loja') && !tabelas.has('item') && !tabelas.has('desejo'));
  } finally {
    destruirBancoTemporario(ambiente);
  }
});
