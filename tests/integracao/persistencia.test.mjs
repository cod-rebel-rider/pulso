/**
 * Testes de integração — persistência real (Fase 02 — Banco de Dados)
 *
 * Ciclo completo exigido pela fase:
 *
 *   criar dado → salvar → fechar conexão → abrir novamente → ler dado
 *
 * Todos os testes usam diretórios temporários isolados — o banco real do
 * usuário NUNCA é tocado (regra da fase).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { inicializarBanco, NOME_ARQUIVO_BANCO } from '../../src/core/database/inicializar.js';
import { RepositorioMeta } from '../../src/core/database/repositorios/meta.js';
import { verificarIntegridade } from '../../src/core/database/conexao.js';

function criarDiretorioTemporario() {
  return mkdtempSync(join(tmpdir(), 'pulso-persistencia-'));
}

test('aplicação inicia sem banco existente → banco criado com schema v1', () => {
  const diretorio = criarDiretorioTemporario();
  try {
    const estado = inicializarBanco({ diretorioDados: diretorio });
    try {
      assert.equal(estado.criado, true, 'o banco deveria ter sido criado agora');
      assert.ok(existsSync(estado.caminho), 'arquivo do banco não encontrado');
      assert.equal(basename(estado.caminho), NOME_ARQUIVO_BANCO);
      assert.equal(estado.versaoSchema, 1);
      assert.deepEqual(
        estado.migracoesAplicadas,
        [{ versao: 1, nome: 'criar-infraestrutura-base' }],
      );
    } finally {
      estado.fechar();
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('persistência completa: salvar → fechar → reabrir → ler (banco reutilizado)', () => {
  const diretorio = criarDiretorioTemporario();
  try {
    const primeiraExecucao = inicializarBanco({ diretorioDados: diretorio });
    const repositorioPrimeiro = new RepositorioMeta(primeiraExecucao.banco);
    repositorioPrimeiro.definir('teste:persistencia', 'funciona');
    primeiraExecucao.fechar(); // memória persistida no disco

    const segundaExecucao = inicializarBanco({ diretorioDados: diretorio });
    try {
      assert.equal(segundaExecucao.criado, false, 'banco existente deve ser reutilizado');
      assert.equal(segundaExecucao.versaoSchema, 1, 'nenhuma migração deve rodar de novo');
      assert.deepEqual(segundaExecucao.migracoesAplicadas, []);

      const repositorioSegundo = new RepositorioMeta(segundaExecucao.banco);
      assert.equal(repositorioSegundo.obter('teste:persistencia'), 'funciona', 'dado sobreviveu ao ciclo');
    } finally {
      segundaExecucao.fechar();
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('banco permanece íntegro após reinicialização (Testes 9 e 10)', () => {
  const diretorio = criarDiretorioTemporario();
  try {
    const primeiraExecucao = inicializarBanco({ diretorioDados: diretorio });
    new RepositorioMeta(primeiraExecucao.banco).definir('integridade', 'ok');
    primeiraExecucao.fechar();

    const segundaExecucao = inicializarBanco({ diretorioDados: diretorio });
    try {
      const integridade = verificarIntegridade(segundaExecucao.banco);
      assert.equal(integridade.ok, true, JSON.stringify(integridade.problemas));
      assert.equal(new RepositorioMeta(segundaExecucao.banco).obter('integridade'), 'ok');
    } finally {
      segundaExecucao.fechar();
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});
