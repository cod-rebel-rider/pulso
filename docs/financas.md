# PULSO — Sistema de Finanças (Fase 08)

> O núcleo financeiro do PULSO.
> **Dinheiro não é um número: é um fluxo rastreável.**

## Conceito

```text
TRANSAÇÕES (o que entrou e o que saiu)
     ↓
CARTEIRA (onde o dinheiro vive)
     ↓
SALDO (consequência — nunca valor editado)
     ↓
ORÇAMENTO (planejamento — não cria dinheiro)
     ↓
VISÃO FINANCEIRA
```

O sistema não diz apenas "você tem R$ 2.450". Ele responde:

- **"De onde veio esse dinheiro?"** — histórico de receitas;
- **"Para onde foi?"** — histórico de despesas por categoria;
- **"Quanto gastei nesta categoria?"** — gastos por categoria;
- **"Quanto ainda tenho no orçamento?"** — limite − despesas do período;
- **"Estorei o orçamento?"** — situação calculada, sem bloqueio.

O saldo é **sempre recalculado** a partir das transações persistidas — não existe coluna de saldo, não existe valor mágico fora do histórico.

## Campos

### Carteira (`carteira`)

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | INTEGER | auto | Identificador interno único |
| `jogador_id` | INTEGER | sim | Jogador dono (FK → jogador, CASCADE) |
| `nome` | TEXT | sim | "Carteira Principal" (estado atual: uma por jogador) |
| `moeda` | TEXT | sim | "BRL" (constante `MOEDA` do domínio) |
| `criado_em` · `atualizado_em` | TEXT | auto | Carimbos ISO 8601 |

A carteira principal é criada junto com o jogador (mesma transação de nascimento) e recriada sob demanda para jogadores de fases anteriores. Sem coluna de saldo — **saldo é derivado**.

### Transação (`transacao`)

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | INTEGER | auto | Identificador interno único |
| `carteira_id` | INTEGER | sim | Carteira dona (FK → carteira, CASCADE) |
| `tipo` | TEXT | sim | `receita` ou `despesa` |
| `valor_centavos` | INTEGER | sim | Valor em centavos inteiros **positivos** (`CHECK > 0`) |
| `categoria` | TEXT | sim | Categoria validada contra o tipo |
| `descricao` | TEXT | não | Contexto opcional (≤140) |
| `ocorrida_em` | TEXT | sim | **Data da ocorrência** (`YYYY-MM-DD`) |
| `criado_em` · `atualizado_em` | TEXT | auto | Momentos do registro no PULSO |

`ocorrida_em` ≠ `criado_em`: uma compra do dia 10 registrada no dia 11 preserva as duas datas.

### Orçamento (`orcamento`)

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | INTEGER | auto | Identificador interno único |
| `jogador_id` | INTEGER | sim | Jogador dono (FK → jogador, CASCADE) |
| `categoria` | TEXT | sim | Categoria de **despesa** acompanhada |
| `nome` | TEXT | não | Apelido opcional (≤60) |
| `valor_centavos` | INTEGER | sim | Limite planejado em centavos (`CHECK > 0`) |
| `inicio` · `fim` | TEXT | sim | Período (`YYYY-MM-DD`), limites **inclusivos**, `CHECK fim >= inicio` |

## Tipos de transação

| Interno | Interface | Efeito no saldo |
| --- | --- | --- |
| `receita` | Receita | aumenta |
| `despesa` | Despesa | reduz |

O **tipo determina o sentido** — nunca um sinal negativo (`despesa` com `valor_centavos = 5000`, nunca `-5000`). A arquitetura aceita um futuro `transferencia` sem quebrar o modelo (não implementado nesta fase).

## Categorias

Constantes controladas no domínio (`src/core/dominio/financa.js`), **separadas por tipo** — o domínio rejeita combinação inválida:

| Receitas | Despesas |
| --- | --- |
| `salario` (SALÁRIO) | `alimentacao` (ALIMENTAÇÃO) |
| `freelance` (FREELANCE) | `transporte` (TRANSPORTE) |
| `missao` (MISSÃO) | `moradia` (MORADIA) |
| `venda` (VENDA) | `contas` (CONTAS) |
| `reembolso` (REEMBOLSO) | `assinaturas` (ASSINATURAS) |
| `saldo_inicial` (SALDO INICIAL) | `lazer` (LAZER) |
| `outra_receita` (OUTRA RECEITA) | `tecnologia` (TECNOLOGIA) |
| | `musica` (MÚSICA) |
| | `saude` (SAÚDE) |
| | `educacao` (EDUCAÇÃO) |
| | `compras` (COMPRAS) |
| | `outra_despesa` (OUTRA DESPESA) |

- `missao` existe como **categoria** desde já, mas **não** há integração automática missão → receita nesta fase.
- `saldo_inicial` documenta a entrada de abertura: dinheiro que o usuário já possuía ao começar a usar o PULSO é registrado como **transação** (movimentação de abertura), nunca como campo `initial_balance` fora do histórico.

## Precisão monetária

- Valores são **inteiros de centavos** em toda a camada financeira — nunca `float`/`double`;
- `1299` = R$ 12,99 · `125075` = R$ 1.250,75;
- a interface formata (`R$ 1.234,56`, padrão brasileiro) mas **nunca calcula** saldo;
- zero não é movimentação; negativos são rejeitados (o sentido vem do tipo);
- a moeda (`BRL`) vive na constante `MOEDA` — não espalhada pelo código.

## Cálculo do saldo (fonte única)

A regra vive **apenas** no domínio (`calcularResumo` em `src/core/dominio/financa.js`) e é aplicada por `ServicoFinanca` — nunca duplicada no renderer, no repositório ou no orçamento:

```text
saldo = Σ receitas confirmadas − Σ despesas confirmadas
```

- `0 + 1000 = 1000` · `1000 + 500 = 1500` · `1500 − 300 = 1200` · `100 − 150 = −50`;
- **saldo negativo é permitido** e apenas indicado na interface — o sistema registra a realidade financeira, não a controla à força (sem punição de RPG, sem alterar status/XP);
- editar (`100 → 80`) ou excluir uma transação muda o saldo automaticamente, pois o saldo é sempre recalculado do conjunto persistido;
- orçamento **não** altera saldo — é planejamento.

## Orçamento

Um orçamento acompanha **despesas reais** de uma categoria de despesa dentro de um período:

```text
situacao = { gasto, disponivel = limite − gasto, estourado = gasto > limite, percentual }
```

- limite 600 / gasto 0 → disponível 600 · limite 600 / gasto 420 → disponível 180 · limite 600 / gasto 650 → **ESTOURADO −50**;
- limites do período são **inclusivos** (01/09 e 30/09 entram; 31/08 e 01/10 não);
- receitas **nunca** consomem orçamento; orçamento **não bloqueia** despesa;
- períodos são datas arbitrárias — o mês calendário é só atalho prático da interface;
- orçamento **geral** (todas as categorias) fica como pendência — mantida a estabilidade da versão por categoria.

## Edição e exclusão

- **Edição** permite alterar valor, tipo, categoria, descrição e data; o domínio revalida tudo (categoria compatível com o novo tipo, valor > 0, período válido) e o saldo reflete a mudança;
- **Exclusão** é controlada: a interface exige confirmação explícita em duas etapas antes de acionar o IPC; após excluir, a transação deixa de participar do saldo e do histórico;
- não há auditoria persistida nesta fase — exclusões e alterações financeiras podem exigir histórico robusto no futuro (registrado em `pendencias.md`); hoje o log do processo principal registra as operações (`Transação criada/atualizada/excluída`).

## Banco de dados

Migração **007 `criar-tabelas-financas`** (DDL completo em `banco-de-dados.md`): `carteira`, `transacao`, `orcamento` — tabelas `STRICT`, `CHECK valor_centavos > 0`, `CHECK tipo IN ('receita','despesa')`, `CHECK fim >= inicio`, foreign keys com CASCADE e índices para os filtros do histórico (carteira + `ocorrida_em DESC`, carteira + categoria).

## Arquitetura

```text
Renderer (js/principal.js — módulo Finanças)
   ↓  window.pulso.financa.* (preload, Object.freeze)
IPC (canais financa:*)
   ↓
Application (servico-financa.js — orquestra e valida)
   ↓
Domain (dominio/financa.js — regras puras)
   ↓
Repository (repositorios/carteira|transacao|orcamento.js)
   ↓
SQLite (node:sqlite)
```

- o renderer **nunca** fala com o SQLite nem calcula saldo;
- sem SQL arbitrário via IPC — apenas operações específicas;
- a carteira nasce no mesmo commit do jogador (`ServicoJogador` chama `ServicoFinanca` na inicialização).

## API interna (IPC)

| Canal | Ponte (`window.pulso.financa`) | Retorno |
| --- | --- | --- |
| `financa:carteira` | `carteira(jogadorId)` | carteira + `saldo` |
| `financa:saldo` | `saldo(jogadorId, {inicio, fim})` | `{receitas, despesas, saldo, carteira}` |
| `financa:resumo` | `resumo(jogadorId, {inicio, fim})` | saldo + período + orçamentos + gastos por categoria + config |
| `financa:listar-transacoes` | `listarTransacoes(jogadorId, {tipo, categoria, inicio, fim})` | transações, mais recentes primeiro |
| `financa:criar-transacao` | `criarTransacao({jogadorId, tipo, valorCentavos, categoria, descricao, data})` | transação criada |
| `financa:atualizar-transacao` | `atualizarTransacao({id, …campos})` | transação atualizada |
| `financa:excluir-transacao` | `excluirTransacao(id)` | `{ok}` |
| `financa:listar-orcamentos` | `listarOrcamentos(jogadorId)` | orçamentos + situação |
| `financa:criar-orcamento` | `criarOrcamento({jogadorId, categoria, nome, valorCentavos, inicio, fim})` | orçamento criado |
| `financa:atualizar-orcamento` | `atualizarOrcamento({id, …campos})` | orçamento atualizado |
| `financa:excluir-orcamento` | `excluirOrcamento(id)` | `{ok}` |
| `financa:situacao-orcamento` | `situacaoOrcamento(id)` | orçamento + situação |

Validações do domínio chegam à interface como `{ok: false, mensagem}` — nunca como exceção crua.

## Interface

Tela própria em três visões (identidade Cyberpunk/terminal, grid discreto):

- **Carteira**: saldo atual em destaque, receitas e despesas do mês corrente, orçamentos com barra de consumo (`ESTOURADO` em vermelho) e histórico filtrável (TODAS / RECEITAS / DESPESAS + categoria);
- **Transação**: formulário tipo → valor (`0,00` brasileiro) → categoria (compatível com o tipo) → descrição → data; edição reutiliza o formulário; exclusão pede confirmação;
- **Orçamento**: categoria de despesa, limite, início e fim; edição e exclusão confirmadas.

Hierarquia visual: saldo grande e neutro; receitas `+` em tom positivo; despesas `−` e alertas em vermelho (uso parcimonioso, conforme `identidade-visual.md`).

## Testes

- **Unidade** (`tests/unidade/financa.test.mjs`): centavos, zero, negativos, valores grandes, categorias por tipo, validação de período, situação de orçamento, conversores;
- **Integração** (`tests/integracao/financa.test.mjs`): ciclo completo jogador → carteira → receita → saldo → despesa → saldo → orçamento; edição (valor, tipo, categoria, data); exclusão recalculando saldo; limites inclusivos do período (01/09 e 30/09 dentro; 31/08 e 01/10 fora); saldo negativo; persistência (fechar/reabrir); categorias incompatíveis rejeitadas.

## Limitações da FASE 08

**A FASE 08 implementa o núcleo financeiro. Ela não implementa loja, compras, serviços ou recompensas financeiras.**

Não implementado (deliberadamente):

- loja, lista de desejos, compra de itens, serviços, contas recorrentes;
- XP financeiro, recompensas de missão ou de projeto (a categoria `missao` existe, sem automação);
- investimentos, cartões de crédito, parcelamento, empréstimos, financiamentos;
- sincronização bancária / Open Finance / integrações externas;
- dashboard final (a visão financeira desta fase **não** é o Dashboard da FASE 15);
- múltiplas carteiras e TRANSFERÊNCIA (arquitetura preparada, sem sistema complexo);
- orçamento geral (além dos orçamentos por categoria);
- categorias personalizadas (constantes no domínio hoje).

## Próximas fases

- **FASE 09 — Loja / Lista de Desejos**: compras consomem saldo via transações (`despesa`); 
- **Serviços e despesas**: despesas recorrentes geram transações;
- **Missões/Projetos**: recompensas geram transações `receita` (com rastro, nunca mágicas);
- **FASE 15 — Dashboard**: consome `financa:resumo`.
