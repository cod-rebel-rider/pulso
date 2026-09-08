/**
 * PULSO — Sistema de migrações (Fase 02 — Banco de Dados)
 *
 * Cada migração é { versao, nome, cima(banco) }:
 * - `versao`: inteiro sequencial, começando em 1;
 * - `nome`: kebab-case descritivo;
 * - `cima`: aplica o DDL/DML — roda dentro de transação.
 *
 * Regras (docs/banco-de-dados.md):
 * - migração já aplicada NUNCA é editada; evolução = nova migração no fim da lista;
 * - execução registrada em `schema_migrations` (versão, nome, momento);
 * - falha → transação revertida + erro identificável;
 * - não há migrações de reversão nesta fase (reversão = restaurar backup).
 *
 * FASE 02: apenas infraestrutura. As tabelas dos módulos (jogador,
 * missões, finanças…) nascerão em migrações das próprias fases.
 */

const CRIAR_TABELA_CONTROLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    versao      INTEGER PRIMARY KEY,
    nome        TEXT    NOT NULL,
    aplicada_em TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT
`;

const SELECIONAR_APLICADAS =
  'SELECT versao, nome, aplicada_em FROM schema_migrations ORDER BY versao';

/** Migração 001 — infraestrutura base do PULSO (Fase 02). */
const MIGRACAO_001 = Object.freeze({
  versao: 1,
  nome: 'criar-infraestrutura-base',
  cima(banco) {
    // `meta`: metadados técnico-operacionais da aplicação (chave/valor).
    // Não é configuração de ambiente (isso vive em config/*.json) e não
    // é dado de sistema de jogo — apenas infraestrutura.
    banco.exec(`
      CREATE TABLE meta (
        chave         TEXT PRIMARY KEY,
        valor         TEXT NOT NULL,
        atualizada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT
    `);
    banco.prepare("INSERT INTO meta (chave, valor) VALUES ('aplicacao', 'PULSO')").run();
  },
});

/** Lista oficial de migrações — fases futuras ACRESCENTAM ao final. */
export const MIGRACOES = Object.freeze([MIGRACAO_001]);

function validarLista(migracoes) {
  migracoes.forEach((migracao, indice) => {
    if (migracao.versao !== indice + 1) {
      throw new Error(
        `Migração na posição ${indice} tem versão ${migracao.versao}; esperada ${indice + 1} (sequência sem lacunas, começando em 1).`,
      );
    }
    if (!migracao.nome || !/^[a-z0-9-]+$/.test(migracao.nome)) {
      throw new Error(`Migração ${migracao.versao} com nome inválido: "${migracao.nome}".`);
    }
    if (typeof migracao.cima !== 'function') {
      throw new Error(`Migração ${migracao.versao} sem a função "cima".`);
    }
  });
}

/**
 * Aplica as migrações pendentes, em ordem, cada uma uma única vez.
 * @param {import('node:sqlite').DatabaseSync} banco
 * @param {Array} [migracoes] padrão: lista oficial (MIGRACOES)
 * @returns {{ aplicadas: Array<{versao: number, nome: string}>, versaoAtual: number }}
 */
export function aplicarMigracoes(banco, migracoes = MIGRACOES) {
  validarLista(migracoes);
  banco.exec(CRIAR_TABELA_CONTROLE);

  const jaAplicadas = new Map(
    banco.prepare(SELECIONAR_APLICADAS).all().map((linha) => [linha.versao, linha.nome]),
  );
  const resultado = {
    aplicadas: [],
    versaoAtual: Math.max(0, ...jaAplicadas.keys()),
  };

  for (const migracao of migracoes) {
    if (jaAplicadas.has(migracao.versao)) continue; // nunca reexecuta

    banco.exec('BEGIN IMMEDIATE');
    try {
      migracao.cima(banco);
      banco
        .prepare('INSERT INTO schema_migrations (versao, nome) VALUES (?, ?)')
        .run(migracao.versao, migracao.nome);
      banco.exec('COMMIT');
      jaAplicadas.set(migracao.versao, migracao.nome);
      resultado.aplicadas.push({ versao: migracao.versao, nome: migracao.nome });
      resultado.versaoAtual = migracao.versao;
    } catch (erro) {
      banco.exec('ROLLBACK');
      throw new Error(
        `Falha na migração ${migracao.versao} (${migracao.nome}) — transação revertida: ${erro.message}`,
      );
    }
  }

  return resultado;
}

/**
 * Versão atual do schema (0 = banco sem migrações aplicadas).
 * Pré-condição: `schema_migrations` já existe (rodar aplicarMigracoes antes).
 */
export function versaoAtual(banco) {
  const linha = banco.prepare('SELECT MAX(versao) AS versao FROM schema_migrations').get();
  return linha?.versao ?? 0;
}
