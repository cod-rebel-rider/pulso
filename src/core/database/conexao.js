/**
 * PULSO — Conexão com o banco SQLite (Fase 02 — Banco de Dados)
 *
 * Único ponto da aplicação que abre, configura e fecha conexões SQLite.
 *
 * Biblioteca: módulo nativo `node:sqlite` (Node embutido no Electron 37
 * → SQLite 3.50.4). Sem dependências externas e sem rebuild de ABI —
 * decisão registrada em docs/banco-de-dados.md (ADR-009).
 *
 * Regras de arquitetura:
 * - camadas superiores (domínio, módulos, interface) nunca abrem conexão;
 *   elas passam por repositórios (src/core/database/repositorios/);
 * - o renderer não tem qualquer acesso a este módulo.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const PRAGMAS = Object.freeze({
  chavesEstrangeiras: 'PRAGMA foreign_keys = ON',
  journalWal: 'PRAGMA journal_mode = WAL',
  tempoEsperaLock: 'PRAGMA busy_timeout = 5000',
  sincronizacaoNormal: 'PRAGMA synchronous = NORMAL',
});

/**
 * Abre e configura uma conexão SQLite, criando o diretório do arquivo
 * quando necessário.
 * @param {{ caminho: string, apenasLeitura?: boolean }} parametros
 * @returns {DatabaseSync} conexão configurada
 */
export function abrirConexao({ caminho, apenasLeitura = false }) {
  if (!caminho) {
    throw new Error('abrirConexao: o caminho do banco é obrigatório.');
  }
  if (!apenasLeitura) {
    mkdirSync(dirname(caminho), { recursive: true });
  }
  let banco;
  try {
    banco = new DatabaseSync(caminho, { readOnly: apenasLeitura });
  } catch (erro) {
    throw new Error(`Não foi possível abrir o banco "${caminho}": ${erro.message}`);
  }
  configurar(banco, apenasLeitura);
  return banco;
}

function configurar(banco, apenasLeitura) {
  // Integridade referencial é regra do projeto: sempre ON, explicitamente.
  banco.exec(PRAGMAS.chavesEstrangeiras);
  if (apenasLeitura) return; // conexões de leitura não alteram o banco

  // WAL: leituras/escritas concorrentes no mesmo processo e resiliência a
  // queda da aplicação (gera os arquivos -wal/-shm junto ao banco).
  banco.exec(PRAGMAS.journalWal);
  // Locks transitórios esperam até 5 s em vez de falhar de imediato.
  banco.exec(PRAGMAS.tempoEsperaLock);
  // NORMAL é o par recomendado com WAL: seguro contra falha da aplicação,
  // com risco residual (já coberto pelo WAL) apenas em queda de energia.
  banco.exec(PRAGMAS.sincronizacaoNormal);
}

/**
 * Fecha a conexão de forma segura.
 * @param {DatabaseSync} banco
 */
export function fecharConexao(banco) {
  if (!banco) return;
  try {
    banco.close();
  } catch (erro) {
    throw new Error(`Falha ao fechar a conexão com o banco: ${erro.message}`);
  }
}

/**
 * Verificação básica de integridade do banco.
 * @param {DatabaseSync} banco
 * @returns {{ ok: boolean, problemas: string[] }}
 */
export function verificarIntegridade(banco) {
  const problemas = [];

  const resultado = banco.prepare('PRAGMA quick_check').get();
  if (resultado?.quick_check !== 'ok') {
    problemas.push(`quick_check: ${resultado?.quick_check ?? 'sem resposta'}`);
  }

  const violacoes = banco.prepare('PRAGMA foreign_key_check').all();
  if (violacoes.length > 0) {
    problemas.push(`foreign_key_check: ${violacoes.length} violação(ões) de chave estrangeira`);
  }

  return { ok: problemas.length === 0, problemas };
}
