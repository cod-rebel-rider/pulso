# PULSO — Sistema de Projetos (Fase 07)

> A principal camada de organização acima das missões.
> **Uma missão é uma ação. Um projeto é uma direção.**

## Conceito

```text
PROJETO ("Para onde essas ações estão me levando?")
   ↓
MISSÕES ("O que eu preciso fazer?")
   ↓
AÇÕES
```

O projeto **não executa** as missões — organiza e acompanha.
Um projeto pode existir sem nenhuma missão (planejar primeiro, decompor depois).

## Campos do projeto

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | INTEGER | auto | Identificador interno único |
| `jogador_id` | INTEGER | sim | Jogador dono (FK → jogador) |
| `titulo` | TEXT | sim | Título (≤120 caracteres) |
| `descricao` | TEXT | não | Detalhes (≤2000) |
| `estado` | TEXT | sim | Estado atual (ver máquina de estados) |
| `prioridade` | TEXT | sim | baixa/normal/alta/crítica (mesmos valores das missões) |
| `prazo` | TEXT | não | Data/hora limite opcional (ISO 8601) |
| `iniciada_em` · `concluida_em` · `cancelada_em` | TEXT | auto | Carimbos das transições |
| `criado_em` · `atualizado_em` | TEXT | auto | Momentos de criação/modificação |

## Estados e transições

| Estado | Interno | Significado |
| --- | --- | --- |
| Planejado | `planejado` | Existe, mas ainda não começou |
| Em andamento | `em_andamento` | Está sendo executado |
| Concluído | `concluido` | Objetivo alcançado (ação explícita do usuário) |
| Cancelado | `cancelado` | Interrompido sem ser concluído |
| Arquivado | `arquivado` | Fora do fluxo ativo (histórico preservado) |

Transições permitidas (domínio, nunca campo livre):

```text
PLANEJADO ──→ EM_ANDAMENTO · CANCELADO · ARQUIVADO
EM_ANDAMENTO ──→ CONCLUÍDO · CANCELADO · ARQUIVADO
CONCLUÍDO ──→ ARQUIVADO
CANCELADO ──→ ARQUIVADO
ARQUIVADO ──→ (nenhuma — não volta ao fluxo sem regra explícita)
```

Arquivar ≠ cancelar: um projeto concluído pode ser arquivado depois.
Conclusão do projeto é **ação explícita** — todas as missões concluídas não
concluem o projeto automaticamente (a interface informa
"Projeto pronto para encerramento", mas decide o usuário).

## Prazo e atraso

- Opcional; pode ser definido, alterado e removido.
- Projeto ativo com `prazo < agora` é exibido como **ATRASADO**.
- Atraso é **apenas informação**: não cancela, não pune, não muda estado,
  não reduz XP, não altera status do jogador.

## Relação Projeto → Missão

- Uma missão pertence a **no máximo um projeto** (`missao.projeto_id`,
  1:N simples — sem N:N nesta fase).
- Missão pode ser `SEM PROJETO` (`projeto_id = NULL`).
- O projeto **referencia** a missão existente — nunca cria cópia.
- Integridade: mesmo jogador obrigatório (rejeitado na camada de aplicação);
  `projeto_id` com `ON DELETE SET NULL` — remover tecnicamente um projeto
  **preserva as missões** (nunca `CASCADE`).
- Associação rejeitada quando a missão já pertence a outro projeto.

## Progresso

```text
progresso = missões concluídas / missões associadas × 100
```

- Calculado **derivamente** (nunca armazenado como número manual).
- **0 missões → 0%** (nunca 100% automático).
- Ex.: 2 de 3 concluídas → 66,67%.
- Concluir missão muda o progresso na próxima consulta; nenhuma recompensa
  adicional é criada (XP pertence à Fase 06 e às regras futuras de recompensa).

## Banco de dados

- **Migração 006** `criar-tabela-projetos` (Fase 07) — **schema v6**.
- **Tabela `projeto`**: FK `jogador_id → jogador(id) ON DELETE CASCADE`,
  estado/prioridade com DEFAULT, índices em `jogador_id` e `estado`.
- **Coluna `missao.projeto_id`** (ALTER TABLE): FK → `projeto(id)`
  `ON DELETE SET NULL`, `NULL` permitido, índice `idx_missao_projeto`.
- Exclusão física existe no repositório (uso técnico) mas **não é operação
  principal da interface** — preferir ARQUIVAR/CANCELAR (histórico preservado).

## Arquitetura

```text
Renderer (window.pulso.projeto.{criar,listar,obter,atualizar,iniciar,concluir,cancelar,arquivar,associarMissao,removerMissao})
   ↓ IPC controlada (canais projeto:*)
Preload (contextBridge, sandbox)
   ↓
Main (handlers → traduzirResultadoOperacao)
   ↓
Aplicação — ServicoProjeto (valida jogador, mesmo dono, conflito de vínculo)
   ↓
Domínio — máquina de estados, validações, cálculo de progresso (puro)
   ↓
Repositório — RepositorioProjeto (SQL exclusivo)
   ↓
SQLite — tabela projeto + missao.projeto_id
```

Sem `executeSQL` genérico — operações específicas e controladas.

## API interna (IPC)

| Operação | Canal | Parâmetros |
| --- | --- | --- |
| criar | `projeto:criar` | `{ jogadorId, titulo, descricao?, prioridade?, prazo? }` |
| listar | `projeto:listar` | `{ jogadorId }` |
| obter | `projeto:obter` | `{ id }` |
| atualizar | `projeto:atualizar` | `{ id, titulo?, descricao?, prioridade?, prazo? }` |
| iniciar / concluir / cancelar / arquivar | `projeto:<acao>` | `{ id }` |
| associar missão | `projeto:associar-missao` | `{ projetoId, missaoId }` |
| remover missão | `projeto:remover-missao` | `{ projetoId, missaoId }` |

## Interface

- **Lista de projetos** (`VER PROJETOS` no painel): cartões com título, barra
  de progresso, estado, prioridade e %; filtros TODOS/PLANEJADOS/EM
  ANDAMENTO/CONCLUÍDOS/CANCELADOS/ARQUIVADOS; botão `CRIAR PROJETO`;
  `VOLTAR AO PAINEL` retorna ao boot.
- **Detalhes do projeto**: título, descrição, ESTADO, PRIORIDADE, PRAZO
  (com indicador **ATRASADO** quando ativo e prazo passado), PROGRESSO e a
  lista de missões com marcador `[✓]/[ ]`.
- **Ações conforme o estado** (a interface respeita a máquina de estados):
  - planejado → INICIAR · CANCELAR · ARQUIVAR;
  - em andamento → CONCLUIR · CANCELAR · ARQUIVAR;
  - concluído/cancelado → ARQUIVAR;
  - arquivado → nenhuma ação ativa.
- **Gerenciamento de missões**: `+ ADICIONAR MISSÃO` abre seletor apenas com
  missões **sem projeto**; remover missão; clicar na missão abre os detalhes
  reutilizando a visão da FASE 05 (nenhuma segunda tela de edição).
- **Formulário de projeto**: título*, descrição, prioridade, prazo —
  o status inicial é sempre PLANEJADO e nunca é solicitado/editado por campo.
- Aviso `Todas as missões concluídas. Projeto pronto para encerramento.`
  quando `prontaParaEncerrar` — sem conclusão automática.

## Limitações da FASE 07

- Projeto **não concede XP** nesta fase.
- Projeto **não concede dinheiro** nesta fase.
- Projeto **não altera atributos** nesta fase.
- Projeto **não altera status** nesta fase.
- Sem dependência entre projetos, subtarefas, kanban, comentários,
  colaboração ou multiusuário; sem relação N:N; sem recorrência nem
  notificações; sem dashboard final; sem Mapa/Trilha (Fase 13).
- Integração com Finanças pertence à Fase 08 — nada implementado.

## Próximas fases

- **Fase 08 — Finanças** (projetos poderão se relacionar com dinheiro depois).
- **Fase 13 — Mapa/Trilha:** projeto como nó maior conectado às missões.
- **Fase 15 — Dashboard:** visualização consolidada de projetos e missões.



