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

import { calcularNivel } from '../dominio/progressao.js';

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

/** Migração 005 — progressão do jogador (Fase 06). */
const MIGRACAO_005 = Object.freeze({
  versao: 5,
  nome: 'criar-tabelas-progressao',
  cima(banco) {
    // XP/nível/pontos: um registro por jogador (UNIQUE + CASCADE).
    // CHECKs impedem estados inconsistentes no próprio banco.
    banco.exec(`
      CREATE TABLE jogador_progressao (
        id                 INTEGER PRIMARY KEY,
        jogador_id         INTEGER NOT NULL UNIQUE REFERENCES jogador(id) ON DELETE CASCADE,
        xp_total           INTEGER NOT NULL CHECK (xp_total >= 0),
        nivel              INTEGER NOT NULL CHECK (nivel >= 1),
        pontos_disponiveis INTEGER NOT NULL CHECK (pontos_disponiveis >= 0),
        criado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT
    `);
    // Atributos: um registro por jogador; mínimo 1 por atributo.
    banco.exec(`
      CREATE TABLE jogador_atributos (
        id             INTEGER PRIMARY KEY,
        jogador_id     INTEGER NOT NULL UNIQUE REFERENCES jogador(id) ON DELETE CASCADE,
        tecnologia     INTEGER NOT NULL CHECK (tecnologia >= 1),
        criatividade   INTEGER NOT NULL CHECK (criatividade >= 1),
        musica         INTEGER NOT NULL CHECK (musica >= 1),
        social         INTEGER NOT NULL CHECK (social >= 1),
        energia        INTEGER NOT NULL CHECK (energia >= 1),
        foco           INTEGER NOT NULL CHECK (foco >= 1),
        disciplina     INTEGER NOT NULL CHECK (disciplina >= 1),
        criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT
    `);
  },
});

/** Migração 006 — projetos + vínculo missão→projeto (Fase 07). */
const MIGRACAO_006 = Object.freeze({
  versao: 6,
  nome: 'criar-tabela-projetos',
  cima(banco) {
    // Projeto: direção que organiza missões. Sem exclusão física como
    // operação principal — arquivar/cancelar preservam o histórico.
    banco.exec(`
      CREATE TABLE projeto (
        id             INTEGER PRIMARY KEY,
        jogador_id     INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
        titulo         TEXT NOT NULL,
        descricao      TEXT,
        estado         TEXT NOT NULL DEFAULT 'planejado',
        prioridade     TEXT NOT NULL DEFAULT 'normal',
        prazo          TEXT,
        iniciada_em    TEXT,
        concluida_em   TEXT,
        cancelada_em   TEXT,
        criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT
    `);
    banco.exec('CREATE INDEX IF NOT EXISTS idx_projeto_jogador ON projeto(jogador_id)');
    banco.exec('CREATE INDEX IF NOT EXISTS idx_projeto_estado ON projeto(estado)');
    // Missão pertence a no máximo UM projeto (1:N simples, sem N:N).
    // SET NULL preserva missões se o projeto for removido tecnicamente.
    banco.exec('ALTER TABLE missao ADD COLUMN projeto_id INTEGER REFERENCES projeto(id) ON DELETE SET NULL');
    banco.exec('CREATE INDEX IF NOT EXISTS idx_missao_projeto ON missao(projeto_id)');
  },
});

/**
 * Migração 007 — finanças (Fase 08): carteira, transações e orçamentos.
 */
const MIGRACAO_007 = Object.freeze({
  versao: 7,
  nome: 'criar-tabelas-financas',
  cima(banco) {
    // Carteira: referenciada pelas transações. Uma carteira principal por
    // jogador é garantida pela aplicação; sem UNIQUE no jogador para não
    // impedir carteiras múltiplas em fases futuras.
    banco.exec(`
      CREATE TABLE carteira (
        id             INTEGER PRIMARY KEY,
        jogador_id     INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
        nome           TEXT NOT NULL,
        moeda          TEXT NOT NULL DEFAULT 'BRL',
        criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT
    `);
    banco.exec('CREATE INDEX IF NOT EXISTS idx_carteira_jogador ON carteira(jogador_id)');

    // Transação: saldo é CONSEQUÊNCIA destas linhas. Valor sempre em centavos,
    // inteiro e positivo (CHECK no banco e no domínio); o sentido (receita/
    // despesa) é dado pelo tipo, nunca pelo sinal do valor. Categoria é TEXT
    // validado pelo domínio (constantes centralizadas em dominio/financa.js).
    banco.exec(`
      CREATE TABLE transacao (
        id             INTEGER PRIMARY KEY,
        carteira_id    INTEGER NOT NULL REFERENCES carteira(id) ON DELETE CASCADE,
        tipo           TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        categoria      TEXT NOT NULL,
        descricao      TEXT,
        ocorrida_em    TEXT NOT NULL,
        criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT
    `);
    banco.exec('CREATE INDEX IF NOT EXISTS idx_transacao_carteira ON transacao(carteira_id)');
    banco.exec('CREATE INDEX IF NOT EXISTS idx_transacao_ocorrida ON transacao(ocorrida_em DESC)');
    banco.exec('CREATE INDEX IF NOT EXISTS idx_transacao_categoria ON transacao(carteira_id, categoria)');

    // Orçamento: planejamento por categoria de DESPESA num período definido.
    // Não cria dinheiro — apenas compara despesas reais com o limite.
    banco.exec(`
      CREATE TABLE orcamento (
        id             INTEGER PRIMARY KEY,
        jogador_id     INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
        categoria      TEXT NOT NULL,
        nome           TEXT,
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        inicio         TEXT NOT NULL,
        fim            TEXT NOT NULL,
        criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (fim >= inicio)
      ) STRICT
    `);
    banco.exec('CREATE INDEX IF NOT EXISTS idx_orcamento_jogador ON orcamento(jogador_id)');
    banco.exec('CREATE INDEX IF NOT EXISTS idx_orcamento_categoria ON orcamento(jogador_id, categoria)');
  },
});

/** Migracao 008 — lista de desejos / loja (Fase 09). */
const MIGRACAO_008 = Object.freeze({
  versao: 8,
  nome: 'criar-tabela-desejo',
  cima(banco) {
    banco.exec(`
      CREATE TABLE desejo (
        id                      INTEGER PRIMARY KEY,
        jogador_id              INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
        titulo                  TEXT NOT NULL,
        descricao               TEXT,
        categoria               TEXT NOT NULL,
        prioridade              TEXT NOT NULL,
        estado                  TEXT NOT NULL,
        valor_esperado_centavos INTEGER NOT NULL CHECK (valor_esperado_centavos > 0),
        valor_pago_centavos     INTEGER CHECK (valor_pago_centavos IS NULL OR valor_pago_centavos > 0),
        diferenca_centavos      INTEGER,
        data_compra             TEXT,
        observacao_compra       TEXT,
        transacao_id            INTEGER REFERENCES transacao(id) ON DELETE SET NULL,
        criado_em               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        comprado_em             TEXT,
        CHECK (estado IN ('desejado', 'em_analise', 'planejado', 'comprado', 'cancelado')),
        CHECK (prioridade IN ('baixa', 'normal', 'alta', 'critica'))
      ) STRICT
    `);
    banco.exec('CREATE INDEX IF NOT EXISTS idx_desejo_jogador ON desejo(jogador_id)');
    banco.exec('CREATE INDEX IF NOT EXISTS idx_desejo_estado ON desejo(jogador_id, estado)');
  },
});

/**
 * Migração 009 — conciliação do schema legado de progressão (Fase 06).
 *
 * Bancos criados pela PRIMEIRA implementação da Fase 06 registraram a
 * versão 5 com outra forma das tabelas:
 *   - `jogador_progressao` SEM a coluna `nivel`;
 *   - `jogador_atributo` (nome no singular).
 * Como o controle de migrações pula a versão já registrada ("nunca
 * reexecuta"), essas tabelas ficaram legadas mesmo com o schema marcado
 * como atual — e qualquer operação de progressão quebrava com
 * "no such column: nivel".
 *
 * Esta migração RECONSTRÓI as tabelas no formato atual da Migração 005:
 *   - `jogador_progressao` ganha `nivel`, derivado do XP acumulado pela
 *     MESMA regra do domínio (`calcularNivel`) — nenhum dado é perdido;
 *   - `jogador_atributo` é reconstruída como `jogador_atributos`.
 * Em bancos novos (ou já corretos) ela não altera nada: cada passo só age
 * quando detecta a forma legada.
 */
const MIGRACAO_009 = Object.freeze({
  versao: 9,
  nome: 'conciliar-progressao-legado',
  cima(banco) {
    const tabelas = new Set(
      banco
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((linha) => linha.name),
    );
    conciliarProgressaoLegada(banco, tabelas);
    conciliarAtributosLegados(banco, tabelas);
  },
});

/** Reconstrói `jogador_progressao` com `nivel` se estiver na forma legada. */
function conciliarProgressaoLegada(banco, tabelas) {
  if (!tabelas.has('jogador_progressao')) return;
  const colunas = banco
    .prepare('PRAGMA table_info(jogador_progressao)')
    .all()
    .map((coluna) => coluna.name);
  if (colunas.includes('nivel')) return; // formato atual — nada a fazer

  // Cópia em tabela nova no formato EXATO da Migração 005; o nível vem do
  // XP acumulado pela regra do domínio (nunca duplicada em SQL).
  banco.exec(`
    CREATE TABLE jogador_progressao_conciliada (
      id                 INTEGER PRIMARY KEY,
      jogador_id         INTEGER NOT NULL UNIQUE REFERENCES jogador(id) ON DELETE CASCADE,
      xp_total           INTEGER NOT NULL CHECK (xp_total >= 0),
      nivel              INTEGER NOT NULL CHECK (nivel >= 1),
      pontos_disponiveis INTEGER NOT NULL CHECK (pontos_disponiveis >= 0),
      criado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      atualizado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT
  `);
  const linhas = banco
    .prepare(
      `SELECT id, jogador_id, xp_total, pontos_disponiveis, criado_em, atualizado_em
         FROM jogador_progressao`,
    )
    .all();
  const inserir = banco.prepare(`
    INSERT INTO jogador_progressao_conciliada
      (id, jogador_id, nivel, xp_total, pontos_disponiveis, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const linha of linhas) {
    inserir.run(
      linha.id,
      linha.jogador_id,
      calcularNivel(linha.xp_total),
      linha.xp_total,
      linha.pontos_disponiveis,
      linha.criado_em,
      linha.atualizado_em,
    );
  }
  // DROP remove junto os índices legados (idx_progressao_jogador…); a tabela
  // nova reproduz a 005, que não cria índices extras (UNIQUE já indexa).
  banco.exec('DROP TABLE jogador_progressao');
  banco.exec('ALTER TABLE jogador_progressao_conciliada RENAME TO jogador_progressao');
}

/** Reconstrói `jogador_atributo` (singular, legada) como `jogador_atributos`. */
function conciliarAtributosLegados(banco, tabelas) {
  if (!tabelas.has('jogador_atributo')) return; // nome legado não existe — nada a fazer
  if (!tabelas.has('jogador_atributos')) {
    banco.exec(`
      CREATE TABLE jogador_atributos_conciliada (
        id             INTEGER PRIMARY KEY,
        jogador_id     INTEGER NOT NULL UNIQUE REFERENCES jogador(id) ON DELETE CASCADE,
        tecnologia     INTEGER NOT NULL CHECK (tecnologia >= 1),
        criatividade   INTEGER NOT NULL CHECK (criatividade >= 1),
        musica         INTEGER NOT NULL CHECK (musica >= 1),
        social         INTEGER NOT NULL CHECK (social >= 1),
        energia        INTEGER NOT NULL CHECK (energia >= 1),
        foco           INTEGER NOT NULL CHECK (foco >= 1),
        disciplina     INTEGER NOT NULL CHECK (disciplina >= 1),
        criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT
    `);
    banco.exec(`
      INSERT INTO jogador_atributos_conciliada
        (id, jogador_id, tecnologia, criatividade, musica, social, energia, foco, disciplina,
         criado_em, atualizado_em)
      SELECT id, jogador_id, tecnologia, criatividade, musica, social, energia, foco, disciplina,
             criado_em, atualizado_em
        FROM jogador_atributo
    `);
    banco.exec('DROP TABLE jogador_atributo');
    banco.exec('ALTER TABLE jogador_atributos_conciliada RENAME TO jogador_atributos');
    return;
  }
  // Caso raro: plural E singular existem. Só descarta a legada se vazia;
  // com dados, bloqueia com instrução clara em vez de perder histórico.
  const { total } = banco.prepare('SELECT COUNT(*) AS total FROM jogador_atributo').get();
  if (total > 0) {
    throw new Error(
      'Conciliação bloqueada: "jogador_atributo" e "jogador_atributos" existem com dados. Mescle manualmente antes de iniciar o PULSO.',
    );
  }
  banco.exec('DROP TABLE jogador_atributo');

/**
 * Migração 010 — serviços (Fase 10.1 — Estrutura de Serviços).
 *
 * O serviço é a estrutura PERMANENTE de uma obrigação/contratação
 * (internet, energia, aluguel…). As futuras contas serão ocorrências
 * desse serviço (Fase 10.2+) — nada de vencimento, recorrência ou
 * pagamento aqui.
 *
 * - `valor_esperado_centavos`: estimativa de custo em centavos (Fase 08),
 *   > 0; NÃO representa dívida nem dinheiro movimentado;
 * - `estado`: 'ativo' | 'inativo' | 'arquivado' (ciclo de vida no domínio);
 * - `arquivado_em`: preenchido apenas quando o serviço é arquivado;
 * - `fornecedor`: texto opcional — sem entidade própria nesta subfase;
 * - categoria: lista controlada do domínio (separada das categorias
 *   financeiras da Fase 08 — decisão documentada em docs/servicos.md).
 */
const MIGRACAO_010 = Object.freeze({
  versao: 10,
  nome: 'criar-tabela-servico',
  cima(banco) {
    banco.exec(`
      CREATE TABLE servico (
        id                      INTEGER PRIMARY KEY,
        jogador_id              INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
        nome                    TEXT NOT NULL,
        descricao               TEXT,
        fornecedor              TEXT,
        categoria               TEXT NOT NULL,
        valor_esperado_centavos INTEGER NOT NULL CHECK (valor_esperado_centavos > 0),
        estado                  TEXT NOT NULL,
        criado_em               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        atualizado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        arquivado_em            TEXT,
        CHECK (estado IN ('ativo', 'inativo', 'arquivado')),
        CHECK (categoria IN (
          'moradia', 'contas', 'telecomunicacoes', 'assinaturas', 'tecnologia',
          'educacao', 'saude', 'transporte', 'lazer', 'trabalho', 'outros'
        ))
      ) STRICT
    `);
    banco.exec('CREATE INDEX IF NOT EXISTS idx_servico_jogador ON servico(jogador_id)');
    banco.exec('CREATE INDEX IF NOT EXISTS idx_servico_estado ON servico(jogador_id, estado)');
  },
});


}

/** Lista oficial de migracoes — fases futuras ACRESCENTAM ao final. */
export const MIGRACOES = Object.freeze([
  MIGRACAO_001,
  MIGRACAO_002,
  MIGRACAO_003,
  MIGRACAO_004,
  MIGRACAO_005,
  MIGRACAO_006,
  MIGRACAO_007,
  MIGRACAO_008,
  MIGRACAO_009,
  MIGRACAO_010,
]);

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
