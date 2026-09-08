# PULSO — Sistema de Missões (Fase 05)

> A principal unidade de ação do PULSO. A missão representa algo que o jogador
> precisa, deseja ou decidiu realizar.

## Conceito

A missão é a ponte entre intenção, ação e conclusão:

```
intenção → ação → conclusão
```

Nesta fase, missões **não** possuem recompensas, XP ou efeitos sobre status.
Esses mecanismos serão conectados nas fases futuras.

## Campos da missão

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | INTEGER | auto | Identificador interno único |
| `jogador_id` | INTEGER | sim | Jogador dono da missão (FK → jogador) |
| `titulo` | TEXT | sim | Título da missão (≤120 caracteres) |
| `descricao` | TEXT | não | Detalhes sobre o que realizar |
| `estado` | TEXT | sim | Estado atual (ver máquina de estados) |
| `prioridade` | TEXT | sim | Prioridade (baixa/normal/alta/crítica) |
| `prazo` | TEXT | não | Data/hora limite opcional (ISO 8601) |
| `iniciada_em` | TEXT | auto | Momento em que foi iniciada |
| `concluida_em` | TEXT | auto | Momento em que foi concluída |
| `cancelada_em` | TEXT | auto | Momento em que foi cancelada |
| `criado_em` | TEXT | auto | Momento de criação |
| `atualizado_em` | TEXT | auto | Última modificação |

## Estados e máquina de estados

### Estados disponíveis

| Estado | Interno (código) | Interface (pt-BR) |
| --- | --- | --- |
| Pendente | `pendente` | Pendente |
| Em andamento | `em_andamento` | Em andamento |
| Concluída | `concluida` | Concluída |
| Cancelada | `cancelada` | Cancelada |

### Transições permitidas

```
PENDENTE ──iniciar──→ EM_ANDAMENTO
PENDENTE ──cancelar──→ CANCELADA
EM_ANDAMENTO ──concluir──→ CONCLUÍDA
EM_ANDAMENTO ──cancelar──→ CANCELADA
```

### Transições proibidas

- `PENDENTE → CONCLUÍDA` (deve iniciar antes)
- `CONCLUÍDA → EM_ANDAMENTO` (sem regra de reabertura explícita)
- `CANCELADA → CONCLUÍDA` (diretamente)
- Qualquer estado → estado inexistente

## Prioridades

| Prioridade | Código | Indicador visual |
| --- | --- | --- |
| Baixa | `baixa` | ◆ (cinza) |
| Normal | `normal` | ◆◆ (branco) |
| Alta | `alta` | ◆◆◆ (vermelho) |
| Crítica | `critica` | ◆◆◆◆ (vermelho pulsante) |

Prioridade é apenas característica da missão — **não** afeta XP, status nem recompensas nesta fase.

## Prazo

- Opcional (`due_at`).
- Uma missão está **atrasada** se `prazo < agora` e estado ≠ concluída/cancelada.
- Atraso é apenas **informação visual** — não altera status, XP, energia, foco ou estresse.

## Exclusão

Regra adotada:
- Qualquer missão pode ser excluída (pendente, em_andamento, concluída, cancelada).
- A exclusão remove o registro do banco (sem soft-delete nesta fase).
- Em fases futuras, pode-se avaliar retenção de histórico.

## Banco de dados

- **Migração 004** `criar-tabela-missoes` (Fase 05) — **schema v4**.
- **Tabela `missao`**:

```sql
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
```

- **`ON DELETE CASCADE`**: ao remover o jogador, suas missões somam junto.
- **Índices**: `jogador_id` (listagem por jogador) e `estado` (filtros).

## Arquitetura

```
Renderer (window.pulso.missao.{criar, listar, obter, atualizar, iniciar, concluir, cancelar, excluir})
   ↓ IPC controlada (canais missao:*)
Preload (contextBridge, sandbox)
   ↓
Main (handlers → traduzirResultadoOperacao)
   ↓
Aplicação — ServicoMissao (orquestração, single-player)
   ↓
Domínio — validarMissao / validarTransicaoEstado / regras puras
   ↓
Repositório — RepositorioMissao (SQL exclusivo)
   ↓
SQLite — tabela missao
```

## API interna (IPC)

| Operação | Canal | Parâmetros | Retorno |
| --- | --- | --- | --- |
| `criar` | `missao:criar` | `{ jogadorId, titulo, descricao?, prioridade?, prazo? }` | `{ ok, missao }` |
| `obter` | `missao:obter` | `{ jogadorId, missaoId }` | `{ ok, missao }` |
| `listar` | `missao:listar` | `{ jogadorId, filtro?, prioridade? }` | `{ ok, missoes }` |
| `atualizar` | `missao:atualizar` | `{ jogadorId, missaoId, dados }` | `{ ok, missao }` |
| `iniciar` | `missao:iniciar` | `{ jogadorId, missaoId }` | `{ ok, missao }` |
| `concluir` | `missao:concluir` | `{ jogadorId, missaoId }` | `{ ok, missao }` |
| `cancelar` | `missao:cancelar` | `{ jogadorId, missaoId }` | `{ ok, missao }` |
| `excluir` | `missao:excluir` | `{ jogadorId, missaoId }` | `{ ok }` |

- **Sem `executeSQL` genérico** — operações são específicas e controladas.

## Decisões arquiteturais

- **Domínio puro:** `src/core/dominio/missao.js` exporta funções puras (validarMissao,
  validarTransicaoEstado, iniciar, concluir, cancelar), testáveis sem banco.
- **Máquina de estados explícita:** transições definidas em objeto `TRICOES_PERMITIDAS`,
  validadas antes de persistir. Mudança de estado só via métodos do domínio.
- **Timestamps automáticos:** `iniciada_em`, `concluida_em`, `cancelada_em` são
  preenchidos pelo domínio na transição; `atualizado_em` pelo repositório.
- **Tradução de erros:** `ErroValidacao`, `ErroTransicao`, `ErroConflito` viram mensagens
  seguras na interface; detalhes técnicos ficam só no log.

## Limitações atuais

- **Sem recompensas:** concluir missão não concede XP, dinheiro, itens nem afeta status.
- **Sem XP:** sistema de XP pertence à Fase 06.
- **Sem recorrência:** missões recorrentes (diária/semana/mês) ficam para fase futura.
- **Sem projetos:** vinculação a projetos será na Fase 07.
- **Sem histórico de eventos:** apenas timestamps essenciais são registrados.
- **Sem notificações:** prazo existe como dado, sem alarmes.
- **Sem efeitos sobre status:** missões não alteram energia/foco/estresse/criatividade.

## Próximas fases

- **Fase 06 — Progressão:** XP, níveis, recompensas por missão.
- **Fase 07 — Projetos:** vinculação de missões a projetos.
- **Fase 15 — Dashboard:** visualização consolidada de missões.
- **Fase 16 — Polimento:** interface definitiva de missões.