# Loja / Lista de Desejos — PULSO

**Fase:** 09 — Loja / Lista de Desejos (implementada). O PULSO agora distingue **EU QUERO** de **EU COMPREI**: desejos planejados com preço esperado, compras registradas com preço real — e a realidade financeira sempre passando pelo motor da Fase 08.

> **Regra fundamental:** a Loja **não possui carteira própria**. Toda movimentação financeira passa pelo sistema financeiro da FASE 08 (`servico-financa.js`). O desejo não gasta dinheiro; a compra gasta.

## Conceito

Um **desejo** representa algo que o jogador pretende adquirir (ex.: "SSD NVMe 1 TB", R$ 450,00, prioridade ALTA). Enquanto está apenas na lista:

- **não** altera a carteira;
- **não** cria transação;
- **não** altera saldo ou orçamento;
- **não** gera XP.

O fluxo da fase:

```text
DESEJO → PREÇO ESPERADO → DECISÃO → COMPRA → PREÇO REAL → TRANSAÇÃO FINANCEIRA → CARTEIRA
```

A compra é **ação explícita** — nada é convertido automaticamente em compra.

## Campos do desejo

| Campo | Regras |
| --- | --- |
| `titulo` | obrigatório, 1–120 caracteres |
| `descricao` | opcional, até 2000 caracteres |
| `categoria` | texto controlado (lista fixa em PT-BR minúsculo) |
| `prioridade` | `baixa` · `normal` · `alta` · `critica` |
| `estado` | máquina de estados (abaixo) |
| `precoEsperado` | inteiro em centavos, **> 0** (o percentual exige denominador válido) |
| `precoFinal` / `diferencaCentavos` / `dataCompra` / `observacao` | preenchidos apenas no registro da compra |
| `transacaoId` | referência à despesa da Fase 08 (`ON DELETE SET NULL`) |

### Categorias de itens

`tecnologia` · `musica` · `vestuario` · `casa` · `transporte` · `educacao` · `lazer` · `trabalho` · `hobby` · `outros` — lista simples e centralizada no domínio (`CATEGORIAS_DESEJO`), fácil de evoluir sem taxonomia complexa.

## Máquina de estados

```text
DESEJADO → EM ANÁLISE → PLANEJADO → COMPRADO
DESEJADO/EM ANÁLISE/PLANEJADO → CANCELADO
```

- Transições fora do grafo são **bloqueadas** (`ErroTransicao`).
- `planejar` a partir de `DESEJADO` passa por `EM ANÁLISE` (dentro da mesma transação SQLite).
- Item comprado **permanece comprado**; cancelado **permanece cancelado** (sem reabertura — para adquirir de novo, crie um novo desejo).
- Editar texto/preço só é permitido antes de `COMPRADO`/`CANCELADO` (preserva o histórico).

## Comparação esperado × real

```text
diferenca   = precoFinal − precoEsperado      (centavos)
percentual  = (diferenca / precoEsperado) × 100
```

- `esperado 1000 · pago 900` → diferença **−100** → economia de R$ 1,00 (−10%).
- `esperado 1000 · pago 1100` → diferença **+100** → gasto acima do esperado (+10%).
- Preço esperado **zero ou negativo** é rejeitado na criação/edição — o percentual nunca fica indefinido.
- O cálculo vive no **domínio** (`calcularDiferencaCompra`), fora do renderer.

## Registro da compra (atomicidade)

```text
REGISTRAR COMPRA
  → validar item (estado permite COMPRADO; não recompra; não cancelado)
  → validar preço final (> 0, centavos)
  → BEGIN IMMEDIATE
      → criarTransacao (ServicoFinanca): despesa na carteira principal
      → registrarCompra no item (preço pago, diferença, data, transacao_id)
    → COMMIT (qualquer falha → ROLLBACK completo)
```

- A Loja **nunca** faz `wallet.balance -= valor` — o saldo é derivado das transações pela Fase 08.
- **Saldo negativo não bloqueia a compra** (regra da Fase 08); não há crédito/financiamento.
- Orçamento: se a categoria da compra tiver orçamento ativo, a situação é recalculada pelo financeiro — a Loja não implementa cálculo próprio.
- Recompra de item `COMPRADO` é bloqueada (`ErroTransicao`).

### Categoria financeira da compra

O desejo **não** cria um segundo sistema de categorias financeiras — cada compra é roteada para uma categoria de despesa existente da Fase 08 (`MAPA_CATEGORIA_FINANCEIRA`):

| Categoria do desejo | Categoria financeira (despesa) |
| --- | --- |
| `tecnologia` | `tecnologia` |
| `musica` | `musica` |
| `vestuario` | `compras` |
| `casa` | `moradia` |
| `transporte` | `transporte` |
| `educacao` | `educacao` |
| `lazer` | `lazer` |
| `trabalho` | `outra_despesa` |
| `hobby` | `lazer` |
| `outros` | `compras` |

Descrição da transação gerada: `Compra: <título do item>` — o histórico financeiro permanece compreensível.

## Cancelamento e exclusão

- Cancelar (`→ CANCELADO`) **não** gera transação, **não** altera carteira/orçamento e **não** apaga o item — o registro permanece para preservar histórico.
- Não há exclusão física na interface. Uma compra registrada nunca é apagada silenciosamente.

## Banco de dados

Migração 008 `criar-tabela-desejo` (tabela `desejo` — schema na seção 5 de `docs/banco-de-dados.md`):

- `valor_esperado_centavos > 0` e `valor_pago_centavos` nulo ou positivo (`CHECK`);
- `estado` e `prioridade` com `CHECK` de domínio;
- `transacao_id REFERENCES transacao(id) ON DELETE SET NULL` — rastreabilidade desejo → compra → transação;
- índices `idx_desejo_jogador` e `idx_desejo_estado` (`jogador_id, estado`);
- escolha pela **tabela única** (campos de compra nulos até a compra) — mais simples e suficiente; tabela separada de compras seria complexidade sem necessidade nesta fase.

## Arquitetura

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Domínio | `src/core/dominio/loja.js` | estados, transições, validações, cálculo de diferença/percentual, mapeamento financeiro |
| Aplicação | `src/core/aplicacao/servico-loja.js` | casos de uso (`criar`, `atualizar`, `analisar`, `planejar`, `comprar`, `cancelar`, `listar`, `listarComprados`, `resumo`, `obter`) e atomicidade da compra |
| Persistência | `src/core/database/repositorios/desejo.js` | SQL da tabela `desejo` (sem acesso direto do renderer) |
| IPC | `src/main/{canais.cjs,preload.cjs,main.js}` | canais específicos, sem SQL arbitrário |
| Interface | `src/renderer/js/loja.js` + seções em `index.html` + estilos em `principal.css` | lista, filtros, detalhe, formulários, histórico, resumo |

## API interna (IPC)

Todos os canais retornam `{ ok, ... }` ou `{ ok: false, erro }` (mesmo padrão da Fase 08):

| Canal | Assinatura (preload `pulso.loja`) |
| --- | --- |
| `loja:listar` | `listar(jogadorId, filtros)` — filtros: `estado`, `categoria`, `prioridade` |
| `loja:obter` | `obter(id)` |
| `loja:criar` | `criar({ jogadorId, titulo, descricao, categoria, prioridade, precoEsperado })` |
| `loja:atualizar` | `atualizar({ id, titulo?, descricao?, categoria?, prioridade?, precoEsperado? })` |
| `loja:analisar` | `analisar(id)` |
| `loja:planejar` | `planejar(id)` |
| `loja:comprar` | `comprar(id, { precoFinal, data?, observacao? })` — atômico |
| `loja:cancelar` | `cancelar(id)` |
| `loja:historico` | `historico(jogadorId)` — itens `COMPRADO`, mais recentes primeiro |
| `loja:resumo` | `resumo(jogadorId)` — contadores, valor estimado, economia histórica |
| `loja:config` | `config()` — categorias, prioridades, estados, máximos (apenas leitura) |

## Interface

Tela própria ("LOJA — LISTA DE DESEJOS") com a identidade cyberpunk estabelecida (fundo escuro, vermelho apenas como destaque): resumo no topo (desejos ativos, planejados, comprados, valor estimado, economia histórica), filtros por estado + categoria + prioridade, cards por item, detalhe com grade esperado/pago/diferença/percentual/data, formulário de desejo e formulário de compra (preço final com máscara PT-BR `R$ 1.200,00`, data opcional, observação opcional) e histórico de compras.

## Validações (mensagens em PT-BR)

Nome vazio/tamanho, preço esperado inválido (zero/negativo/não inteiro), preço final inválido, valores acima do máximo, categoria/prioridade/estado inválidos, jogador inexistente, item inexistente, edição após compra/cancelamento, mudança de estado fora do grafo, recompra bloqueada, cancelamento de comprado bloqueado, transação financeira inválida (propagada da Fase 08 com rollback).

## Testes

- `tests/unidade/loja.test.mjs` — domínio puro: estados/transições (válidas e inválidas), criação/edição/compra (validações), diferença e percentual (economia, gasto acima, valores grandes), mapeamento financeiro, descrição da transação.
- `tests/integracao/loja.test.mjs` — banco real: criar/consultar/editar/persistir; máquina de estados com `ErroTransicao`; compra atômica (despesa criada + saldo + vínculo `transacaoId` + rollback quando o financeiro falha); histórico ordenado; cancelamento sem efeito financeiro; persistência após reabrir; integração completa desejo → planejar → comprar → despesa → saldo → histórico.
- Testes manuais executados (cenários 1–8 da fase): ver `docs/testes.md`.

## Limitações da FASE 09

- Sem estoque, marketplace, loja online, busca automática de preços, web scraping, cupons, cashback, comparador de lojas.
- Sem parcelamento, cartão de crédito, financiamento, empréstimos, investimentos, assinaturas, serviços recorrentes (Fase 10).
- Sem notificações/alertas automáticos, integração com bancos/Open Finance.
- Sem integração com missão, XP por compras, habilidades, conquistas, reputação, música, mapa, dashboard final (Fase 15).
- Sem sincronização online, conta de usuário, multiusuário.
- Sem reabertura de desejo cancelado ou desfazer compra; sem exclusão física pela interface.

## Próximas fases

- **FASE 10 — Serviços e Despesas** (recorrências, contas e serviços) pode reutilizar o padrão de compra atômica e o mapeamento de categorias.
- O resumo da loja é deliberadamente simples; o dashboard consolidado pertence à Fase 15.
