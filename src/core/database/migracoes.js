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

/** Migração 002 — identidade do jogador (Fase 03). */
const MIGRACAO_002 = Object.freeze({
  versao: 2,
  nome: 'criar-tabela-jogador',
  cima(banco) {
    // Entidade central do PULSO. Aplicação é single-player: o SERVIÇO
    // impõe um único jogador; o schema permanece aberto a evolução futura
    // (perfis múltiplos exigiriam apenas nova lógica, não novo schema).
    // `id` é a identidade interna — nome/codinome podem mudar livremente.
    banco.exec(`
      CREATE TABLE jogador (
        id            INTEGER PRIMARY KEY,
        nome          TEXT NOT NULL,
        codinome      TEXT,
        criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT
    `);
  },
});

/** Migração 003 — estado atual do jogador / sistema de status (Fase 04). */
const MIGRACAO_003 = Object.freeze({
  versao: 3,
  nome: 'criar-tabela-status',
  cima(banco) {
    // Estado operacional do jogador DENTRO do PULSO (mecânicas de gameplay),
    // não diagnóstico clínico. Um status por jogador (UNIQUE) — histórico
    // completo fica para uma fase futura (docs/status.md).
    banco.exec(`
      CREATE TABLE jogador_status (
        id             INTEGER PRIMARY KEY,
        jogador_id     INTEGER NOT NULL UNIQUE REFERENCES jogador(id) ON DELETE CASCADE,
        energia        INTEGER NOT NULL,
        foco           INTEGER NOT NULL,
        estresse       INTEGER NOT NULL,
        criatividade   INTEGER NOT NULL,
        criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT
    `);
  },
});

/** Migração 004 — sistema de missões (Fase 05). */
const MIGRACAO_004 = Object.freeze({
  versao: 4,
  nome: 'criar-tabela-missoes',
  cima(banco) {
    // Unidade de ação do PULSO. Toda missão pertence a um jogador (FK).
    // `estado` e `prioridade` são TEXT validados pelo domínio (src/core/dominio/missao.js).
    // `prazo` é opcional; `iniciada_em`/`concluida_em`/`cancelada_em` registram timestamps.
    // Índices: jogador_id (filtros por jogador), estado (filtros), prioridade (ordenação).
    banco.exec(`
      CREATE TABLE missao (
        id              INTEGER PRIMARY KEY,
        jogador_id      INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
        titulo          TEXT NOT NULL,
        descricao       TEXT,
        estado          TEXT NOT NULL DEFAULT 'pendente',
        prioridade      TEXT NOT NULL DEFAULT 'normal',
        prazo           TEXT,
        criado_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        iniciada_em     TEXT,
        concluida_em    TEXT,
        cancelada_em    TEXT
      ) STRICT
    `);
    banco.exec('CREATE INDEX IF NOT EXISTS idx_missao_jogador ON missao(jogador_id)');
    banco.exec('CREATE INDEX IF NOT EXISTS idx_missao_estado ON missao(estado)');
    banco.exec('CREATE INDEX IF NOT EXISTS idx_missao_prioridade ON missao(prioridade)');
  },
});

/** Migração 005 — progressão do jogador: XP, nível e atributos (Fase 06). */
const MIGRACAO_005 = Object.freeze({
  versao: 5,
  nome: 'criar-tabela-progressao',
  cima(banco) {
    // Progressão do jogador: XP total, nível (derivado) e pontos de atributo.
    // O nível é calculado a partir do XP (não armazenado como coluna mutável),
    // mas persistimos xp_total e pontos_disponiveis para evitar recálculo.
    banco.exec(`
      CREATE TABLE jogador_progressao (
        id                   INTEGER PRIMARY KEY,
        jogador_id           INTEGER NOT NULL UNIQUE REFERENCES jogador(id) ON DELETE CASCADE,
        xp_total             INTEGER NOT NULL DEFAULT 0,
        pontos_disponiveis   INTEGER NOT NULL DEFAULT 0,
        criado_em            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (xp_total >= 0),
        CHECK (pontos_disponiveis >= 0)
      ) STRICT
    `);

    // Atributos do jogador: características de progressão (diferentes dos status).
    // Todos começam em 1. Valores entre 1 e 100.
    banco.exec(`
      CREATE TABLE jogador_atributo (
        id                   INTEGER PRIMARY KEY,
        jogador_id           INTEGER NOT NULL UNIQUE REFERENCES jogador(id) ON DELETE CASCADE,
        tecnologia           INTEGER NOT NULL DEFAULT 1,
        criatividade         INTEGER NOT NULL DEFAULT 1,
        musica               INTEGER NOT NULL DEFAULT 1,
        social               INTEGER NOT NULL DEFAULT 1,
        energia              INTEGER NOT NULL DEFAULT 1,
        foco                 INTEGER NOT NULL DEFAULT 1,
        disciplina           INTEGER NOT NULL DEFAULT 1,
        criado_em            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (tecnologia BETWEEN 1 AND 100),
        CHECK (criatividade BETWEEN 1 AND 100),
        CHECK (musica BETWEEN 1 AND 100),
        CHECK (social BETWEEN 1 AND 100),
        CHECK (energia BETWEEN 1 AND 100),
        CHECK (foco BETWEEN 1 AND 100),
        CHECK (disciplina BETWEEN 1 AND 100)
      ) STRICT
    `);

    banco.exec('CREATE INDEX IF NOT EXISTS idx_progressao_jogador ON jogador_progressao(jogador_id)');
    banco.exec('CREATE INDEX IF NOT EXISTS idx_atributo_jogador ON jogador_atributo(jogador_id)');
  },
});

/** Lista oficial de migrações — fases futuras ACRESCENTAM ao final. */
export const MIGRACOES = Object.freeze([MIGRACAO_001, MIGRACAO_002, MIGRACAO_003, MIGRACAO_004, MIGRACAO_005]);

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
