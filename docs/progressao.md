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
- **Limite de magnitude:** XP total e quantidade precisam ser inteiros
  *seguros* (`Number.isSafeInteger`); uma soma que estoure o limite seguro é
  rejeitada com `ErroValidacao` em vez de gravar um valor impreciso.
- **Origem do XP:** `adicionarXp` aceita origem opcional (`MISSAO`, `PROJETO`,
  `CONQUISTA`, `OUTRO` — `ORIGENS_XP`), validada por `validarOrigemXp`. A
  origem **não é persistida** nesta fase (não há histórico de XP): existe para
  que missões (P-022) e projetos (P-024) reutilizem o mesmo caso de uso sem
  alterar contrato. A operação atual é interna/controlada
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
- **Teto absoluto: 100** (`ATRIBUTO_MAXIMO`), garantido pelo domínio e pela
  aplicação. Nesta fase **não** há `CHECK` de teto no banco (decisão D-2 e
  P-021). Um valor legado acima de 100 continua sendo exibido e preservado,
  mas não evolui mais.
- Distribuição via `aumentarAtributo` (incrementos controlados, ex.: +1);
  exige pontos suficientes e respeita o teto; operação atômica (atributos +
  pontos). Pontos que excederiam o teto **permanecem disponíveis**.
- Sem reset/respec nesta fase (pendência futura).

## Banco de dados

- **Migração 005** `criar-tabelas-progressao` (Fase 06) — **schema v5**.
- **Tabela `jogador_progressao`** (`jogador_id` UNIQUE + CASCADE;
  `CHECK (xp_total >= 0)`, `CHECK (nivel >= 1)`,
  `CHECK (pontos_disponiveis >= 0)`).
- **Tabela `jogador_atributos`** (`jogador_id` UNIQUE + CASCADE;
  cada atributo com `CHECK (... >= 1)`).
- **Migração 009** `conciliar-progressao-legado` — conciliação de bancos
  criados pela PRIMEIRA implementação da fase (commit `7473e06`): reconstrói
  `jogador_progressao` com a coluna `nivel` (derivada do XP acumulado pela
  mesma regra do domínio) e `jogador_atributo` (singular) como
  `jogador_atributos`, preservando os dados. É **no-op** em bancos novos ou já
  corretos. Detalhes em `banco-de-dados.md` (§6).
- Inicialização atômica junto ao jogador (transação jogador + status +
  progressão); jogador antigo sem progressão é inicializado sem duplicar — o
  reparo de progressão e/ou atributos ausentes roda em transação: as duas
  tabelas são criadas juntas, ou nenhuma.

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

Todas as operações públicas devolvem a **mesma visão congelada**
(`Object.freeze`), incluindo `subiuNivel` e `niveisGanhos` — que valem
`false`/`0` quando a operação não concede nível (consulta ou aumento de
atributo). A interface lê uma única forma, sem campos opcionais.
`adicionarXp` e `aumentarAtributo` são transacionais; `obter` abre transação
apenas no reparo de jogador legado.

## Interface

- Painel PERSONAGEM no boot: nível, barra de XP (`xpNoNivel / xpNecessario`),
  XP restante para o próximo nível, pontos disponíveis e os 7 atributos com
  botão +1 (desabilitado sem pontos).
- A barra expõe semântica de progresso (`role="progressbar"` +
  `aria-valuemin/valuemax/valuenow/valuetext`), sempre com valores vindos do
  domínio — a interface não recalcula XP, nível nem teto.
- O botão +1 **não** conhece o teto de atributo: quem recusa o incremento
  acima de 100 é o domínio, e a mensagem aparece em `#aviso-progressao`
  (nenhuma regra de negócio no renderer).
- Feedback de level up: modal `LEVEL UP — NÍVEL X — +N PONTO(S)`.
- Botão de teste `SIMULAR XP +50` (desenvolvimento, como o AJUSTAR STATUS).
- Navegação: `VER MISSÕES` leva à lista; `VOLTAR AO PAINEL`/`PAINEL` retornam.

## Decisões da Fase 06

Registradas na adequação pós-auditoria (ver `docs/auditoria-fase-06.md`):

| # | Decisão | Justificativa |
| --- | --- | --- |
| D-1 | O teto de atributo voltou a existir: `ATRIBUTO_MAXIMO = 100`. | O limite original havia sido removido sem decisão registrada; sem teto não há regra de evolução por atributo. |
| D-2 | O teto é garantido pelo **domínio/aplicação**, sem `CHECK` no banco nesta fase. | Reconstruir `jogador_atributos` para adicionar `CHECK` poderia abortar a migração em bancos com valores legados acima de 100; segue o precedente já registrado em P-021 ("a aplicação garante os limites antes de persistir"). Valores legados permanecem legíveis. |
| D-3 | A origem do XP é validada, mas **não persistida**. | Histórico/ledger de XP está fora do escopo da fase; validar a origem tira `ORIGENS_XP` do estado de código morto e prepara P-022/P-024 sem exigir mudança de contrato depois. |
| D-4 | A visão de progressão tem **forma única e congelada** nos três métodos. | Elimina o contrato assimétrico: antes `subiuNivel`/`niveisGanhos` existiam só em `adicionarXp`, e o caminho de XP = 0 devolvia objeto não congelado. |
| D-5 | O reparo de jogador legado em `obter` roda em **transação**. | Antes, uma falha na segunda escrita deixava estado parcial (progressão sem atributos); agora as duas tabelas são criadas juntas ou nenhuma. |
| D-6 | XP total e quantidade são limitados a inteiros **seguros**. | Soma que estourasse `Number.isSafeInteger` gravaria valor impreciso; agora é rejeitada com `ErroValidacao`. |

## Limitações da Fase 06

- Recompensas de missões NÃO conectadas automaticamente ao XP (pendência
  P-022 permanece aberta — integração futura quando a arquitetura pedir).
- Sem sistema de projetos (Fase 07), habilidades, dinheiro, loja, conquistas,
  reputação, inventário, integrações externas ou dashboard final.
- Sem histórico de concessões de XP (apenas o total acumulado) — por isso a
  origem da concessão é validada e descartada (D-3).
- Teto de atributo sem `CHECK` no banco nesta fase (D-2; ver P-021 em
  `pendencias.md`).
- Sem teste automatizado de interface (e2e) nem de handler IPC em execução:
  cobertos por análise estática (`tests/unidade/ipc-progressao.test.mjs`),
  teste de fumaça e testes de integração (ver P-032).
- Sem reset de atributos.
