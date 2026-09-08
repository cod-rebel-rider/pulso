# Banco de Dados — PULSO

**Fase:** 02 — Banco de Dados (implementada). A memória local do PULSO está ativa.

## 1. Banco: SQLite (local-first)

Banco em arquivo único, sem servidor, offline por natureza — ideal para os princípios do projeto (local-first, privacidade, portabilidade futura). Bancos remotos/servidos (MySQL, PostgreSQL, Firebase etc.) ficam descartados por regra da fase.

## 2. Biblioteca: `node:sqlite` nativo (ADR-009)

**Decisão:** usar o módulo **`node:sqlite`** do próprio Node embutido no Electron (Electron 37.10.3 → Node 22.21.1 → **SQLite 3.50.4**). Zero dependências externas, zero compilação/rebuild de ABI.

| Opção | Prós | Contras | Veredito |
| --- | --- | --- | --- |
| **`node:sqlite` (nativo)** | sem dependência externa; sem rebuild entre versões do Electron; API síncrona simples; mesma compilação para app e testes | marcado experimental no Node 22 (aviso no console); sem API de backup pronta | **escolhida** |
| `better-sqlite3` | maduro, rápido, amplamente usado | módulo nativo: exige rebuild para a ABI do Electron a cada versão; dependência externa de build (python/make) | alternativa principal se `node:sqlite` tornar-se insuficiente |
| `sqlite3` (callback) | histórico | API assíncrona antiga; rebuild nativo igual | descartada |
| `sql.js` (WASM) | sem rebuild | persistência manual do arquivo inteiro; mais lenta; não indicada para dados vivos | descartada |

O aviso `ExperimentalWarning: SQLite` é inofensivo e registrado aqui. Se a API mudar em versões futuras do Electron, o impacto fica confinado a `src/core/database/conexao.js`.

## 3. Localização do banco (dinâmica, nunca no repositório)

O processo principal resolve o diretório de dados via Electron:

```text
app.getPath('appData') + '/pulso'  →  app.setPath('userData', ...)
```

| Ambiente | Local efetivo (Linux) |
| --- | --- |
| Desenvolvimento/produção | `~/.config/pulso/pulso.db` |
| Teste de fumaça | diretório temporário (`/tmp/pulso-fumaca-*`) criado e descartado por execução |

Em outros sistemas operacionais o caminho acompanha o padrão da plataforma (Fase 18). O núcleo (`src/core/database/`) **nunca** resolve caminhos — recebe o diretório pronto; assim é testável sem Electron.

**Arquivos gerados** (modo WAL): `pulso.db` + `pulso.db-wal` + `pulso.db-shm`. Os três são ignorados pelo Git (`*.db`, `*.db-wal`, `*.db-shm` no `.gitignore`).

## 4. Configuração da conexão (PRAGMAs justificados)

| PRAGMA | Valor | Justificativa |
| --- | --- | --- |
| `foreign_keys` | `ON` | regra da fase — integridade referencial sempre ativa, explícita |
| `journal_mode` | `WAL` | leitura/escrita concorrente no mesmo processo; resiliência a queda da aplicação; custo: arquivos `-wal`/`-shm` |
| `busy_timeout` | `5000` | locks transitórios esperam até 5 s em vez de falhar de imediato |
| `synchronous` | `NORMAL` | par recomendado com WAL: seguro contra falha da aplicação; risco residual apenas em queda de energia (janela mínima) |

## 5. Schema atual (versão 1)

Apenas infraestrutura — nenhuma tabela de sistema de jogo (elas nascem nas fases próprias).

```sql
-- controle de migrações (criado pelo mecanismo, não por migração)
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
```

- `schema_migrations` responde "qual é a versão atual do banco?" (`SELECT MAX(versao)`).
- `meta` guarda metadados técnico-operacionais (chave/valor). **Não** é configuração de ambiente (isso vive em `config/*.json`) nem dado de sistema de jogo.
- `STRICT` impõe tipagem real nas colunas (SQLite ≥ 3.37; embutido aqui: 3.50.4).

## 6. Sistema de migrações

Implementado em `src/core/database/migracoes.js`:

- cada migração é `{ versao, nome, cima(banco) }` — versão sequencial sem lacunas, nome kebab-case, `cima` aplica o DDL/DML;
- pendentes rodam em **ordem**, cada uma **uma única vez**, dentro de `BEGIN IMMEDIATE … COMMIT`, com registro em `schema_migrations`;
- **falha → `ROLLBACK` automático** (inclusive DDL, que é transacional no SQLite) e erro identificável: `Falha na migração N (nome) — transação revertida: …`;
- a lista é validada antes de tocar no banco (sequência, nome, função);
- não há migrações de reversão: reverter = restaurar backup (seção 9).

**Regra de ouro:** migração aplicada **nunca** é editada. Precisou mudar o schema? Nova migração no fim da lista (`MIGRACOES`).

**Como uma fase futura adiciona sua migração** (exemplo da Fase 03):

```js
// src/core/database/migracoes.js
const MIGRACAO_002 = Object.freeze({
  versao: 2,
  nome: 'criar-tabela-jogador',
  cima(banco) {
    banco.exec(`CREATE TABLE jogador (...) STRICT`);
  },
});
export const MIGRACOES = Object.freeze([MIGRACAO_001, MIGRACAO_002]);
```

Cada módulo evolui o banco com as migrações da sua fase (Fase 03 → jogador; Fase 05 → missões; Fase 08 → finanças…), respeitando o mecanismo central.

## 7. Camada de acesso (padrão de repositório)

```text
src/core/database/
├── conexao.js                  → abrir/configurar/fechar + verificarIntegridade
├── migracoes.js                → lista oficial + executor + versaoAtual
├── inicializar.js              → localizar/criar → conectar → migrar → validar
└── repositorios/
    └── meta.js                 → RepositorioMeta (padrão de referência)
```

Padrão estabelecido (ver `src/core/database/repositorios/meta.js`):

- SQL vive **somente** nos repositórios — nunca no domínio, nunca na interface;
- statements preparados uma vez, no construtor;
- métodos com nomes de intenção (`obter`, `definir`, `remover`), sem vazamento de SQL;
- repositórios futuros (jogador, missões…) seguem o mesmo modelo em `repositorios/`.

Fluxo de inicialização da aplicação (main.js):

```text
Electron inicia → resolve userData (dinâmico) → inicializarBanco()
  → abrir conexão (PRAGMAs) → aplicar migrações pendentes → validar (quick_check)
  → disponível para a aplicação → janela abre
Falhou? → erro registrado + diálogo + encerramento (a aplicação não finge funcionar)
No encerramento (will-quit): conexão fechada com segurança.
```

O renderer enxerga apenas um canal de leitura (`banco:info` → versão do schema, sem caminhos). **Não existe IPC genérica de SQL** (`executeSQL`) — por regra de segurança, cada operação futura terá um canal específico.

## 8. Estratégia de testes

- **Isolamento total:** todos os testes usam bancos `:memory:` ou diretórios temporários (`mkdtemp`) — o banco real do usuário nunca é tocado.
- **Suíte:** `tests/unidade/{conexao,migracoes}.test.mjs` + `tests/integracao/persistencia.test.mjs` + teste de fumaça do Electron (que inicializa o banco em diretório temporário e valida o schema).
- **Cobertura da fase:** criação automática, reutilização, migração única (não reexecuta), migração pendente, falha com rollback, foreign keys ativas, fechamento, reinício, integridade pós-reinício, ciclo salvar→fechar→reabrir→ler.
- **Runner:** a suíte roda com o **Node embutido do Electron** (`npm test` → `ELECTRON_RUN_AS_NODE=1 electron --test`), pois é o mesmo runtime da aplicação — o Node do sistema (20.x) não possui `node:sqlite`.

## 9. Backup manual (o backup automático é pendência futura — P-017)

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
