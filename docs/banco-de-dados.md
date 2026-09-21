# Banco de Dados — PULSO

**Fase:** 02 — Banco de Dados (implementada). A memória local do PULSO está ativa e evolui por migrações (a Fase 03 levou o schema a v2, com o jogador).

##  ̈1. Banco: SQLite (local-first)

Banco em arquivo único, sem servidor, offline por natureza — ideal para os princípios do projeto(local-first, privacidade, portabilidade futura. Bancos remotos/servidos(MySQL, PostgreSQL, Firebase etc.) ficam descartados por regra da fase.



##  ̈2. Biblioteca:`node:sqlite` nativo(ADR-009

**Decisão:** usar o módulo **`node:sqlite`** do próprio Node embutido no Electron(Electron 37.10.3 → Node  ̈22.21.1 → **SQLite 3.50.4**). Zero dependências externas,,zero compilação/rebuild de ABI.



| Opção | Prós | Contras | Veredito |
| --- | --- | --- | --- |
| **`node:sqlite`(nativo** | sem dependência externa; sem rebuild entre versões do Electron; API síncrona simples; mesma compilação para app e testes | marcado experimental no Node  ̈22 (aviso no console); sem API de backup pronta | **escolhida** |
| `better-sqlite3` | maduro,,rápido,,amplamente usado | módulo nativo: exige rebuild para a ABI do Electron a cada versão; dependência externa de build(python/make) | alternativa principal se `node:sqlite` tornar-se insuficiente |
| `sqlite3` (callback) | histórico | API assíncrona antiga; rebuild nativo igual | descartada |
| `sql.js` (WASM) | sem rebuild | persistência manual do arquivo inteiro; mais lenta; não indicada para dados vivos | descartada |



O aviso `ExperimentalWarning: SQLite` é inofensivo,e registrado aqui. Se a API mudar em versões futuras do Electron, o impacto fica confinado a `src/core/database/conexao.js`.

##  ̈3. Localização do banco (dinâmica,,nunca no repositório

O processo principal resolve o diretório de dados via Electron:

 `app.getPath('appData') + '/pulso'` → `app.setPath('userData', ...)`.



| Ambiente | Local efetivo(Linux) |
| --- | --- |
| Desenvolvimento/produção | `~/.config/pulso/pulso.db` |
| Teste de fumaça | diretório temporário(`/tmp/pulso-fumaca-*`) criado e descartado por execução |



Em outros sistemas operacionais o caminho acompanha o padrão da plataforma(Fase 18. O núcleo(`src/core/database/`) **nunca** resolve caminhos—recebe o diretório pronto; assim é testável sem Electron. Desde a Fase 03, `PULSO_DIRETORIO_DADOS` permite apontar outro diretório(útil em testes manuais.

**Arquivos gerados** (modo WAL): `pulso.db` + `pulso.db-wal` + `pulso.db-shm`. Os três são ignorados pelo Git(`*.db`, `*.db-wal`, `*.db-shm` no `.gitignore`.

##  ̈4. Configuração da conexão(PRAGMAs justificados

| PRAGMA | Valor | Justificativa |
| --- | --- | --- |
| `foreign_keys` | `ON` | regra da fase—integridade referencial sempre ativa,,explícita |
| `journal_mode` | `WAL` | leitura/escrita concorrente no mesmo processo; resiliência a queda da aplicação; custo: arquivos `-wal`/`-shm` |
| `busy_timeout` | `5000` | locks transitórios esperam até 5 s em vez de falhar de imediato |
| `synchronous` | `NORMAL` | par recomendado com WAL: seguro contra falha da aplicação; risco residual apenas em queda de energia(janela mínima) |

##  ̈5. Schema atual(versão 14

Infraestrutura + entidades de negócio implementadas até a **Fase 10.5** (cada fase acrescenta sua migração ao final da lista — ver `src/core/database/migracoes.js`).



```sql
-- controle de migrações(criado pelo mecanismo,,não por migração)
CREATE TABLE IF NOT EXISTS schema_migrations (
  versao      INTEGER PRIMARY KEY,
  nome        TEXT    NOT NULL,
  aplicada_em TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;



-- migração 001 "criar-infraestrutura-base"
CREATE TABLE meta (
  chave         TEXT PRIMARY KEY,
  valor         TEXT NOT NULL,
  atualizada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
INSERT INTO meta (chave, valor) VALUES ('aplicacao', 'PULSO');



-- migração 002 "criar-tabela-jogador" — Fase  03
CREATE TABLE jogador (
  id            INTEGER PRIMARY KEY,
  nome          TEXT NOT NULL,
  codinome      TEXT,
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- migração 003 "criar-tabela-status" — Fase 04
CREATE TABLE jogador_status (
  id             INTEGER PRIMARY KEY,
  jogador_id     INTEGER NOT NULL UNIQUE REFERENCES jogador(id) ON DELETE CASCADE,
  energia        INTEGER NOT NULL,
  foco           INTEGER NOT NULL,
  estresse       INTEGER NOT NULL,
  criatividade   INTEGER NOT NULL,
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- migração 004 "criar-tabela-missoes" — Fase 05
CREATE TABLE missao (
  id             INTEGER PRIMARY KEY,
  jogador_id     INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  titulo         TEXT NOT NULL,
  descricao      TEXT,
  estado         TEXT NOT NULL DEFAULT 'pendente',
  prioridade     TEXT NOT NULL DEFAULT 'normal',
  prazo          TEXT,
  iniciada_em    TEXT,
  concluida_em   TEXT,
  cancelada_em   TEXT,
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_missao_jogador ON missao(jogador_id);
CREATE INDEX IF NOT EXISTS idx_missao_estado ON missao(estado);

-- migração 005 "criar-tabelas-progressao" — Fase 06 (ver docs/progressao.md)
CREATE TABLE jogador_progressao (
  id                 INTEGER PRIMARY KEY,
  jogador_id         INTEGER NOT NULL UNIQUE REFERENCES jogador(id) ON DELETE CASCADE,
  xp_total           INTEGER NOT NULL CHECK (xp_total >= 0),
  nivel              INTEGER NOT NULL CHECK (nivel >= 1),
  pontos_disponiveis INTEGER NOT NULL CHECK (pontos_disponiveis >= 0),
  criado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

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
) STRICT;

-- migração 006 "criar-tabela-projetos" — Fase 07 (ver docs/projeto.md)
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
) STRICT;

CREATE INDEX IF NOT EXISTS idx_projeto_jogador ON projeto(jogador_id);
CREATE INDEX IF NOT EXISTS idx_projeto_estado ON projeto(estado);

-- vínculo missão → projeto (1:N; SET NULL preserva missões)
ALTER TABLE missao ADD COLUMN projeto_id INTEGER REFERENCES projeto(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_missao_projeto ON missao(projeto_id);

-- migração 007 "criar-tabelas-financas" — Fase 08 (ver docs/financas.md)
CREATE TABLE carteira (
  id             INTEGER PRIMARY KEY,
  jogador_id     INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  moeda          TEXT NOT NULL DEFAULT 'BRL',
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_carteira_jogador ON carteira(jogador_id);

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
) STRICT;

CREATE INDEX IF NOT EXISTS idx_transacao_carteira ON transacao(carteira_id);
CREATE INDEX IF NOT EXISTS idx_transacao_ocorrida ON transacao(ocorrida_em DESC);
CREATE INDEX IF NOT EXISTS idx_transacao_categoria ON transacao(carteira_id, categoria);

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
) STRICT;

CREATE INDEX IF NOT EXISTS idx_orcamento_jogador ON orcamento(jogador_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_categoria ON orcamento(jogador_id, categoria);

-- migração 008 "criar-tabela-desejo" — Fase 09 (ver docs/loja.md)
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
) STRICT;

CREATE INDEX IF NOT EXISTS idx_desejo_jogador ON desejo(jogador_id);
CREATE INDEX IF NOT EXISTS idx_desejo_estado ON desejo(jogador_id, estado);

-- migração 009 "conciliar-progressao-legado" — conciliação de bancos criados
-- pela PRIMEIRA implementação da Fase 06 (sem `nivel` em
-- `jogador_progressao` e com `jogador_atributo` no singular). Reconstrói as
-- tabelas no formato da migração 005 preservando os dados; `nivel` é
-- derivado do XP acumulado pela MESMA regra do domínio (`calcularNivel`).
-- Em bancos novos (ou já corretos) ela NÃO altera nada: cada passo só age
-- quando detecta a forma legada.

-- migração 010 "criar-tabela-servico" — Fase 10.1
-- serviço: estrutura PERMANENTE de serviço recorrente (o "molde").

-- migração 011 "criar-tabela-servico-conta" — Fase 10.2 (ver docs/contas-despesas.md)
-- ocorrência CONCRETA de um serviço (conta/despesa manual, sem efeito financeiro).

-- migração 012 "criar-tabela-servico-recorrencia" — Fase 10.3 (ver docs/recorrencias.md)
CREATE TABLE servico_recorrencia (
  id                      INTEGER PRIMARY KEY,
  jogador_id              INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  servico_id              INTEGER NOT NULL REFERENCES servico(id) ON DELETE RESTRICT,
  frequencia              TEXT NOT NULL,
  data_inicio             TEXT NOT NULL,
  data_fim                TEXT,
  dia_vencimento          INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  valor_esperado_centavos INTEGER NOT NULL CHECK (valor_esperado_centavos > 0),
  descricao               TEXT,
  estado                  TEXT NOT NULL,
  criado_em               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  arquivado_em            TEXT,
  CHECK (estado IN ('ativa', 'inativa', 'arquivada')),
  CHECK (frequencia IN (
    'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'
  )),
  CHECK (data_inicio GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (data_fim IS NULL OR data_fim GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
) STRICT;

CREATE INDEX IF NOT EXISTS idx_servico_recorrencia_jogador ON servico_recorrencia(jogador_id);
CREATE INDEX IF NOT EXISTS idx_servico_recorrencia_servico ON servico_recorrencia(servico_id);
CREATE INDEX IF NOT EXISTS idx_servico_recorrencia_estado ON servico_recorrencia(jogador_id, estado);

-- migração 013 "adicionar-recorrencia-id-em-servico-conta" — Fase 10.4 (ver docs/geracao-ocorrencias.md)
-- rastreabilidade da geração: a conta guarda a recorrência que a criou.
ALTER TABLE servico_conta
  ADD COLUMN recorrencia_id
    INTEGER REFERENCES servico_recorrencia(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_servico_conta_recorrencia ON servico_conta(recorrencia_id);

-- migração 014 "campos-de-pagamento-e-estado-paga-em-servico-conta" — Fase 10.5 (ver docs/pagamentos.md)
-- SQLite não altera CHECK por ALTER TABLE e a v11 limitava estado a
-- ('pendente', 'cancelada') → servico_conta é RECONSTRUÍDA no formato completo
-- (padrão da conciliação da v9), preservando linhas, UNIQUE(servico_id,
-- referencia) e recorrencia_id. Passa a aceitar 'paga' e guardar o desfecho.
CREATE TABLE servico_conta_pagamento (
  id                      INTEGER PRIMARY KEY,
  jogador_id              INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  servico_id              INTEGER NOT NULL REFERENCES servico(id) ON DELETE RESTRICT,
  referencia              TEXT NOT NULL,
  descricao               TEXT,
  valor_esperado_centavos INTEGER NOT NULL CHECK (valor_esperado_centavos > 0),
  vencimento              TEXT NOT NULL,
  estado                  TEXT NOT NULL,
  criado_em               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  cancelado_em            TEXT,
  recorrencia_id          INTEGER REFERENCES servico_recorrencia(id) ON DELETE SET NULL,
  paid_amount             INTEGER,
  paid_at                 TEXT,
  payment_description     TEXT,
  transaction_id          INTEGER REFERENCES transacao(id) ON DELETE SET NULL,
  CHECK (estado IN ('pendente', 'paga', 'cancelada')),
  CHECK (referencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  CHECK (vencimento GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (paid_amount IS NULL OR paid_amount > 0),
  CHECK (paid_at IS NULL OR paid_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (estado <> 'paga' OR (paid_amount IS NOT NULL AND paid_at IS NOT NULL)),
  UNIQUE (servico_id, referencia)
) STRICT;

INSERT INTO servico_conta_pagamento (...colunas originais...)
  SELECT ...colunas originais..., NULL, NULL, NULL, NULL FROM servico_conta;
DROP TABLE servico_conta;
ALTER TABLE servico_conta_pagamento RENAME TO servico_conta;

-- índices originais recriados + vínculo rastreado CONTA → TRANSAÇÃO:
-- UMA transação só pode estar vinculada a UMA conta (não duplica o débito)
CREATE UNIQUE INDEX IF NOT EXISTS idx_servico_conta_transaction
  ON servico_conta(transaction_id) WHERE transaction_id IS NOT NULL;
```

- `schema_migrations` responde "qual é a versão atual do banco?" (`SELECT MAX(versao)` . Atual: **v14**..
- `meta` guarda metadados técnico-operacionais(chave/valor. **Não** é configuração de ambiente(,isso vive em `config/*.json`) nem dado de sistema de jogo..

- `jogador` (ver `docs/jogador.md`): identidade do operador — entidade central do PULSO; single-player imposta pelo Serviço,, com schema aberto a evolução futura.
- `carteira` (ver `docs/financas.md`): carteira do jogador — hoje uma principal por jogador (garantida pela aplicação, sem `UNIQUE` para não travar carteiras múltiplas futuras); saldo nunca é coluna — é consequência das transações.
- `transacao` (ver `docs/financas.md`): movimentação financeira — valor em **centavos inteiros positivos** (`CHECK valor_centavos > 0`), tipo `receita`/`despesa` (o sentido vem do tipo, nunca do sinal), categoria validada pelo domínio, `ocorrida_em` (data da ocorrência, `YYYY-MM-DD`) separado de `criado_em` (registro no PULSO).
- `orcamento` (ver `docs/financas.md`): planejamento por categoria de despesa num período (limites inclusivos; `CHECK fim >= inicio`) — não cria dinheiro e não altera saldo.
- `desejo` (ver `docs/loja.md`): item da lista de desejos (Fase 09) — preço esperado/pago em centavos inteiros positivos, estado com `CHECK` de domínio e `transacao_id` apontando para a despesa criada pela compra (`ON DELETE SET NULL` preserva o histórico do desejo mesmo se a transação for excluída manualmente no financeiro). Desejo **nunca** movimenta saldo por si só — só a compra, via transação.
- `servico` (Fase 10.1): estrutura permanente de serviço recorrente (ex.: Internet) — o "molde" do qual as contas derivam.
- `servico_conta` (ver `docs/contas-despesas.md` e `docs/pagamentos.md`, Fases 10.2 e 10.5, migrações 011 e 014, schema **v14**): ocorrência concreta de um serviço (ex.: Internet · `2026-09` · vence `2026-09-15` · R$ 120,00 em centavos). `servico_id` com `ON DELETE RESTRICT`, `UNIQUE(servico_id, referencia)` contra duplicatas, estado persistido `pendente`/`paga`/`cancelada` (`VENCIDA` é derivada, nunca gravada). A Fase 10.5 acrescenta o desfecho do pagamento: `paid_amount` (> 0 — o valor REALMENTE pago, pode diferir do esperado), `paid_at`, `payment_description` e `transaction_id` → `transacao(id)` (`ON DELETE SET NULL` + índice único parcial: uma transação só debita uma conta), com `CHECK estado <> 'paga' OR (paid_amount IS NOT NULL AND paid_at IS NOT NULL)`. Criar/editar/cancelar **não** cria transação e **não** altera carteira/saldo — só o PAGAMENTO o faz, pelo fluxo da Fase 08.
- `servico_recorrencia` (ver `docs/recorrencias.md`, Fase 10.3, migração 012, schema **v12**): a REGRA DE REPETIÇÃO de um serviço (frequência `mensal`…`anual` com `CHECK`, início obrigatório, término opcional, dia de vencimento 1–31, valor esperado > 0 em centavos). `servico_id` com `ON DELETE RESTRICT`; estado persistido `ativa`/`inativa`/`arquivada` com `CHECK`; `arquivado_em` marca o fim. É apenas **regra** — nenhuma conta, transação ou movimento de saldo é derivado dela nesta subfase (geração na Fase 10.4).
- `STRICT` impõe tipagem real nas colunas(SQLite ≥  3.37; embutido aqui: 3.50.4.

##  ̈6. Sistema de migrações

Implementado em `src/core/database/migracoes.js`:

- cada migração é `{ versao, nome, cima(banco) }` — versão sequencial sem lacunas, nome kebab-case, `cima` aplica o DDL/DML;
- pendentes rodam em **ordem**, cada uma **uma única vez**, dentro de `BEGIN IMMEDIATE … COMMIT`, com registro em `schema_migrations`;
- **falha → `ROLLBACK` automático** (inclusive DDL, que é transacional no SQLite) e erro identificável: `Falha na migração N (nome) — transação revertida: …`;
- a lista é validada antes de tocar no banco (sequência, nome, função);
- não há migrações de reversão: reverter = restaurar backup (seção 9.

**Regra de ouro:** migração aplicada **nunca** é editada. Precisou mudar o schema? Nova migração no fim da lista (`MIGRACOES`).

**Como uma fase futura adiciona sua migração** (exemplo real da Fase 03):

```js
// src/core/database/migracoes.js
const MIGRACAO_002 = Object.freeze({
  versao: 2,
  nome: 'criar-tabela-jogador',
  cima(banco) {
    banco.exec('CREATE TABLE jogador (...) STRICT');
  },
});
export const MIGRACOES = Object.freeze([MIGRACAO_001, MIGRACAO_002]);
```

Cada módulo evolui o banco com as migrações da sua fase (Fase 03 → jogador [aplicada]; Fase 04 → status; Fase 05 → missões…), respeitando o mecanismo central.

### Migração 009 — conciliação do banco legado da Fase 06 (correção)

**Incidente:** bancos criados pela PRIMEIRA implementação da Fase 06 (commit `7473e06`, branch antiga da fase) registraram a migração de progressão com outro nome e formato: `jogador_progressao` **sem** a coluna `nivel` e `jogador_atributo` no singular. Como o mecanismo pula migrações **por versão** (nunca reexecuta), esses bancos avançaram até a v8 com as tabelas de progressão no formato legado — e qualquer operação de progressão quebrava com `no such column: nivel`.

**Decisão:** como migração aplicada nunca é editada, a correção veio como **nova migração no fim da lista** (v9, `conciliar-progressao-legado`), que:

1. reconstrói `jogador_progressao` no formato exato da migração 005, **derivando `nivel` do XP acumulado pela mesma regra do domínio** (`calcularNivel`) — XP e pontos disponíveis são preservados;
2. reconstrói `jogador_atributo` (singular) como `jogador_atributos`, preservando todos os atributos;
3. nos dois casos só age **quando detecta a forma legada** — em bancos novos ou já corretos a migração é um no-op, o que a torna segura para toda a base instalada;
4. caso raro de coexistência das duas formas de atributos: descarta a legada se vazia; com dados, **bloqueia com instrução clara** em vez de arriscar perder histórico.

**Validação:** replicada em testes automatizados (réplica do banco legado com dados do usuário + verificação de preservação + idempotência + no-op em banco correto) e confirmada em uma **cópia** do banco real afetado (dados preservados, `nivel` correto, reexecução vazia). O original só é migrado quando o PULSO é iniciado normalmente com a versão corrigida.

##  ̈7. Camada de acesso (padrão de repositório)

```text
src/core/database/
├── conexao.js                  → abrir/configurar/fechar + verificarIntegridade
├── migracoes.js                → lista oficial + executor + versaoAtual
├── inicializar.js              → localizar/criar → conectar → migrar → validar
└── repositorios/
    ├── meta.js                 → RepositorioMeta (padrão de referência)
    ├── jogador.js              → RepositorioJogador (Fase 03)
    ├── status.js               → RepositorioStatus (Fase 04)
    ├── missao.js               → RepositorioMissao (Fase 05)
    ├── progressao.js           → RepositorioProgressao (Fase 06)
    ├── projeto.js              → RepositorioProjeto (Fase 07)
    ├── carteira.js             → RepositorioCarteira (Fase 08)
    ├── transacao.js            → RepositorioTransacao (Fase 08)
    └── orcamento.js            → RepositorioOrcamento (Fase 08)
```

Padrão estabelecido (ver `src/core/database/repositorios/meta.js`):

- SQL vive **somente** nos repositórios — nunca no domínio, nunca na interface;
- statements preparados uma vez, no construtor;
- métodos com nomes de intenção (`obter`, `definir`, `remover`), sem vazamento de SQL;
- repositórios das fases seguem o mesmo modelo em `repositorios/` (o jogador — Fase 03 — já segue o padrão);
- migrações atuais: **001** (infraestrutura), **002** (jogador — Fase 03), **003** (status — Fase 04), **004** (missões — Fase 05), **005** (progressão — Fase 06), **006** (projetos — Fase 07), **007** (finanças — Fase 08), **008** (lista de desejos — Fase 09), **009** (conciliação do banco legado da progressão), **010** (serviço — Fase 10.1), **011** (conta — Fase 10.2), **012** (recorrência — Fase 10.3), **013** (vínculo da geração de ocorrências — Fase 10.4) e **014** (campos de pagamento e estado `paga` — Fase 10.5) — **schema v14**.

Fluxo de inicialização da aplicação (main.js):

```text
Electron inicia → resolve userData (dinâmico) → inicializarBanco()
  → abrir conexão (PRAGMAs) → aplicar migrações pendentes → validar (quick_check)
  → disponível para a aplicação → janela abre
Falhou? → erro registrado + diálogo + encerramento (a aplicação não finge funcionar)
No encerramento (will-quit): conexão fechada com segurança.
```

O renderer enxerga apenas canais de leitura/específicos (`banco:info`, `jogador:estado`…), sem caminhos nem SQL. **Não existe IPC genérica de SQL** (`executeSQL`) — por regra de segurança, cada operação futura terá um canal específico.

##  ̈8. Estratégia de testes

- **Isolamento total:** todos os testes usam bancos `:memory:` ou diretórios temporários (`mkdtemp`) — o banco real do usuário nunca é tocado.
- **Suíte:** `tests/unidade/{conexao,migracoes,loja}.test.mjs` + `tests/integracao/{persistencia,jogador,status,missao,projeto,financa,loja}.test.mjs` + teste de fumaça do Electron (que inicializa o banco em diretório temporário, valida o schema e o fluxo IPC do jogador).
- **Cobertura da fase:** criação automática, reutilização, migração única (não reexecuta), migração pendente, falha com rollback, foreign keys ativas, fechamento, reinício, integridade pós-reinício, ciclo salvar→fechar→reabrir→ler — a cadeia completa do jogador (criar, consultar, atualizar, persistir, validar, bloquear múltiplos) e, desde a Fase 09, compra atômica com despesa + item + rollback (ver `docs/loja.md`).
- **Runner:** a suíte roda com o **Node embutido do Electron** (`npm test` → `ELECTRON_RUN_AS_NODE=1 electron --test`), pois é o mesmo runtime da aplicação — o Node do sistema (20.x) não possui `node:sqlite`.

##  ̈9. Backup manual (o backup automático é pendência futura — P-017)

**O que preservar:** o diretório de dados inteiro — no Linux, `~/.config/pulso/` (contém `pulso.db` e, com WAL, `pulso.db-wal` e `pulso.db-shm`).

**Cópia segura (recomendada)** — com a aplicação aberta ou fechada, via SQL (consistente por definição):

```bash
# usa o próprio Electron como runtime Node:
ELECTRON_RUN_AS_NODE=1 npx electron -e "
  const { DatabaseSync } = require('node:sqlite');
  const origem = new DatabaseSync(process.env.HOME + '/.config/pulso/pulso.db', { readOnly: true });
  origem.exec(\"VACUUM INTO '\" + process.env.HOME + \"/backup-pulso.db'\");
  origem.close();
  console.log('backup criado');
"
```

**Cópia direta de arquivos:** feche o PULSO antes. Copiando em uso, é obrigatório copiar os **três arquivos juntos** (`pulso.db`, `-wal`, `-shm`) — copiar só o `.db` pode perder transações recentes que ainda estão no WAL. `VACUUM INTO` não tem esse risco.

**Restauração:** fechar a aplicação, devolver o arquivo (e remover `-wal`/`-shm` antigos), reabrir.

## 10. Criptografia (não implementada — requisito futuro a avaliar)

Não há criptografia do banco nesta fase: o dado é local, do próprio usuário, e o custo/risco de soluções experimentais não se justifica ainda. Se um dia for necessário (ex.: executável portátil em pendrive compartilhado), avaliar **SQLCipher** (via `better-sqlite3` com cipher ou build próprio) contra: ameaça real, impacto no backup/portabilidade, recuperação de senha perdida e manutenção. Decisão deve vir como novo ADR.

## 11. Limitações atuais

- `node:sqlite` é experimental no Node 22 — aviso no console; risco mitigado por estar confinado a `conexao.js` (ADR-009);
- sem migrações de reversão (restauração por backup);
- sem backup automático, verificação agendada de integridade ou limpeza do WAL (VACUUM) — pendências futuras;
- sem índices além das chaves primárias — serão criados quando as consultas reais existirem.

## 12. Ferramentas do ambiente

- O CLI `sqlite3` continua **não instalado** (opcional): `sudo apt install sqlite3` para inspeção manual.
- Alternativa sem instalar nada: usar o Electron como runtime Node (exemplo na seção 9) ou o DB Browser for SQLite (gráfico).