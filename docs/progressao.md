# PULSO — Sistema de Progressão (Fase 06)

> O motor de evolução do personagem. A Fase 05 criou a ação; a Fase 06 cria a evolução.

## Conceito

```text
XP → Nível → Pontos de atributo → Atributos
```

A progressão é independente do sistema de status (Fase 04): o atributo
representa uma característica de evolução; o status representa um estado
atual. `energia`/`foco` como atributo NÃO são `energia`/`foco` como status.

## XP e curva

- O jogador possui `xp_total` acumulado (auditoria simples, sem depender de
  "XP até o próximo nível" como única fonte).
- Curva centralizada em `src/core/dominio/progressao.js`:
  **XP necessário = 100 × nível atual** (linear, previsível, documentada).
  - Nível 1 → 100 XP · nível 2 → 200 XP · nível 3 → 300 XP …
- O jogador começa no **nível 1**, com **0 XP** e **0 pontos**.
- Nível calculado a partir do XP total (`calcularNivel`/`calcularProgresso`).
- `adicionarXp`: zero não altera; negativo é rejeitado; múltiplos níveis em
  um único ganho são processados (cada nível concede pontos).
- Origens futuras previstas (`MISSAO`, `PROJETO`, `CONQUISTA`, `OUTRO`) —
  nenhum módulo as utiliza ainda. A operação atual é interna/controlada
  (botão SIMULAR XP +50 na interface, para testes manuais).

## Nível e pontos

- Cada nível conquistado concede **+1 ponto de atributo**.
- O nível inicial não concede ponto (ponto representa evolução).
- Exemplo: nível 1 → 2 concede 1 ponto; salto 1 → 3 concede 2 pontos.

## Atributos

| Atributo | Interno | Inicial |
| --- | --- | --- |
| TECNOLOGIA | `tecnologia` | 1 |
| CRIATIVIDADE | `criatividade` | 1 |
| MÚSICA | `musica` | 1 |
| SOCIAL | `social` | 1 |
| ENERGIA | `energia` | 1 |
| FOCO | `foco` | 1 |
| DISCIPLINA | `disciplina` | 1 |

- Mínimo absoluto: 1 (garantido no domínio e por `CHECK` no banco).
- Distribuição via `aumentarAtributo` (incrementos controlados, ex.: +1);
  exige pontos suficientes; operação atômica (atributos + pontos).
- Sem reset/respec nesta fase (pendência futura).

## Banco de dados

- **Migração 005** `criar-tabelas-progressao` (Fase 06) — **schema v5**.
- **Tabela `jogador_progressao`** (`jogador_id` UNIQUE + CASCADE;
  `CHECK (xp_total >= 0)`, `CHECK (nivel >= 1)`,
  `CHECK (pontos_disponiveis >= 0)`).
- **Tabela `jogador_atributos`** (`jogador_id` UNIQUE + CASCADE;
  cada atributo com `CHECK (... >= 1)`).
- Inicialização atômica junto ao jogador (transação jogador + status +
  progressão); jogador antigo sem progressão é inicializado sem duplicar.

## Arquitetura

```text
Renderer (window.pulso.progressao.{obter, adicionarXp, aumentarAtributo})
   ↓ IPC controlada (canais progressao:obter / progressao:adicionar-xp / progressao:aumentar-atributo)
Preload (contextBridge, sandbox)
   ↓
Main (handlers → traduzirResultadoOperacao)
   ↓
Aplicação — ServicoProgressao (orquestração + transações)
   ↓
Domínio — curva, nível, pontos, atributos (puro, testável)
   ↓
Repositórios — RepositorioProgressao / RepositorioAtributos (SQL exclusivo)
   ↓
SQLite — jogador_progressao + jogador_atributos
```

Sem `executeSQL` genérico — operações específicas e controladas.

## Interface

- Painel PERSONAGEM no boot: nível, barra de XP (`xpNoNivel / xpNecessario`),
  XP restante para o próximo nível, pontos disponíveis e os 7 atributos com
  botão +1 (desabilitado sem pontos).
- Feedback de level up: modal `LEVEL UP — NÍVEL X — +N PONTO(S)`.
- Botão de teste `SIMULAR XP +50` (desenvolvimento, como o AJUSTAR STATUS).
- Navegação: `VER MISSÕES` leva à lista; `VOLTAR AO PAINEL`/`PAINEL` retornam.

## Limitações da Fase 06

- Recompensas de missões NÃO conectadas automaticamente ao XP (pendência
  P-022 permanece aberta — integração futura quando a arquitetura pedir).
- Sem sistema de projetos (Fase 07), habilidades, dinheiro, loja, conquistas,
  reputação, inventário, integrações externas ou dashboard final.
- Sem histórico de concessões de XP (apenas o total acumulado).
- Sem reset de atributos.
