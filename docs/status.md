# PULSO — Sistema de Status (Fase 04)

> Estado operacional do jogador **dentro do PULSO** — mecânicas de gameplay e
> organização pessoal. **NÃO** são diagnóstico médico, avaliação psicológica
> nem medição clínica.

## Conceito

O jogador possui uma identidade (Fase 03) e agora também possui um **estado**.
Os status representam condições operacionais percebidas para realizar
atividades dentro do sistema. São mutáveis e pertencem ao jogador.

## Status disponíveis

| Status | Faixa | Valor inicial | Significado dentro do sistema |
| --- | --- | --- | --- |
| **Energia** | 0–100 | 100 | Disponibilidade operacional percebida para atividades |
| **Foco** | 0–100 | 100 | Capacidade operacional de concentração |
| **Estresse** | 0–100 | 0 | Pressão/acúmulo (0 = menor, 100 = maior) |
| **Criatividade** | 0–100 | 100 | Estado relacionado à produção criativa |

## Regras

- **Faixa fixa:** todo status respeita `0 ≤ valor ≤ 100`. Valores fora disso são
  limitados automaticamente (ex.: 150 → 100, -20 → 0).
- **Estrutura centralizada:** a regra de limite vive em
  `src/core/dominio/status.js` (função `limitar`), nunca espalhada pelas telas.
- **Status desconhecido é rejeitado:** tentar alterar `"mana"` gera erro controlado.
- **Cada jogador tem UM único estado atual** (histórico completo fica para fase futura).
- **Criação atômica:** quando o jogador é criado, seu status inicial é criado na
  **mesma transação** (`BEGIN IMMEDIATE`). Falha em qualquer um → rollback.
- **Migração segura:** jogador antigo (banco de versão anterior) sem status tem o
  estado inicializado automaticamente, sem duplicatas.

## Banco de dados

- **Migração 003** `criar-tabela-status` (Fase 04) — **schema v3**.
- **Tabela `jogador_status`**:

```sql
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
```

- **`UNIQUE` em `jogador_id`** garante um estado por jogador.
- **`ON DELETE CASCADE`**: ao remover o jogador, seu status some junto.
- **`atualizado_em`** é atualizado a cada alteração (via SQL `strftime`).

## Arquitetura

```
Renderer (window.pulso.status.{obter, alterar})  — sem SQL, sem filesystem
   ↓ IPC controlada (canais status:obter / status:alterar)
Preload (contextBridge, sandbox)
   ↓
Main (handlers → traduzirResultadoOperacao)
   ↓
Aplicação — ServicoStatus (orquestração, single-state)
   ↓
Domínio — validarNomeStatus / limitar / calcularNovoValor
   ↓
Repositório — RepositorioStatus (SQL exclusivo)
   ↓
SQLite — tabela jogador_status
```

## API interna (IPC)

| Operação | Canal | Parâmetros | Retorno |
| --- | --- | --- | --- |
| `obter` | `status:obter` | `{ jogadorId }` | `{ ok, status }` |
| `alterar` | `status:alterar` | `{ jogadorId, status, delta }` | `{ ok, status }` |

- `status` é o nome (`'energia'` \| `'foco'` \| `'estresse'` \| `'criatividade'`).
- `delta` é a alteração (pode ser negativa ou positiva).
- **Sem `executeSQL` genérico** — operações são específicas e controladas.

## Decisões arquiteturais

- **Domínio puro:** `src/core/dominio/status.js` exporta funções puras, testáveis
  sem banco. Limites e validações ficam centralizados ali.
- **Transação na criação:** `ServicoJogador` recebe `banco` + `aoCriar` para criar
  jogador + status de forma atômica (Fase 04 — `src/core/database/transacao.js`).
- **Serviço de status idempotente:** `criarInicial` não duplica se o status já existe.
- **Tradução de erros:** `ErroValidacao`/`ErroConflito` viram mensagens seguras na
  interface; detalhes técnicos ficam só no log.

## Limitações atuais

- **Sem histórico:** apenas o estado atual é persistido. Registro de mudanças ao
  longo do tempo fica para fase futura.
- **Sem automação:** status não mudam sozinhos com o tempo. Alterações vêm de
  missões/eventos (fases futuras) ou do botão de teste (desenvolvimento).
- **Sem validação de faixa no banco:** constraints de `CHECK(energia BETWEEN 0 AND 100)`
  não foram adicionadas — a aplicação garante os limites antes de persistir.
  (Pode ser adicionado em fase de polimento.)

## Próximas fases

- **Fase 05 — Missões:** poderão alterar status como efeito.
- **Fase 06 — Progressão:** introduzirá atributos (diferentes dos status).
- **Fase 15 — Dashboard:** exibição definitiva dos status.
