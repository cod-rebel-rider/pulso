# Contas / Despesas — PULSO

**Fase:** 10.2 — Contas e Despesas (implementada). Transforma um **Serviço** (estrutura permanente, Fase 10.1) em uma **ocorrência concreta de despesa** — sem movimentar dinheiro.

> **Regra fundamental:** criar, editar ou cancelar uma conta **NÃO cria transação financeira**, **NÃO altera a carteira** e **NÃO altera o saldo**. O pagamento é uma operação financeira futura (Fase 10.5).

## Conceito

```text
SERVIÇO = estrutura permanente (ex.: Internet)
   ↓
CONTA = ocorrência concreta (ex.: Internet · Setembro/2026 · vence 15/09 · R$ 120,00)
   ↓
PAGAMENTO = futura operação financeira (Fase 10.5)
   ↓
TRANSAÇÃO = futuro registro na Fase 08
   ↓
CARTEIRA = já existente (Fase 08, intocada nesta subfase)
```

Cada conta é um registro independente, criado **manualmente**. A geração automática por recorrência pertence às Fases 10.3/10.4 — deliberadamente fora do escopo.

## Campos da conta

| Campo | Regras |
| --- | --- |
| `servicoId` | obrigatório; o serviço precisa existir **e** pertencer ao mesmo jogador (`ErroConflito` se inexistente; `ErroValidacao` se de outro jogador) |
| `referencia` | competência canônica **`AAAA-MM`** (ex.: `2026-09`); `UNIQUE(servico_id, referencia)` impede duplicar a ocorrência |
| `descricao` | opcional, até 2000 caracteres (`null` quando vazia) |
| `valorEsperado` | inteiro em **centavos, > 0** — reutiliza `validarValorCentavos` da Fase 08; representa a **expectativa**, não dinheiro gasto |
| `vencimento` | data civil `AAAA-MM-DD`, com rejeição de datas inexistentes (ex.: `2026-02-30`) |
| `estado` | persistido: `pendente` · `cancelada` (nasce `pendente`) |
| `situacao` | **derivada**, nunca gravada: `pendente` · `vencida` · `cancelada` |
| `canceladoEm` | preenchido no cancelamento; o registro nunca é apagado |

## Estados × situações (decisão documentada)

O banco guarda apenas `pendente` / `cancelada`. **`VENCIDA` é condição de apresentação/consulta**, derivada em `situacaoConta`:

```text
cancelada                          → CANCELADA
pendente + vencimento < hoje       → VENCIDA
pendente + vencimento >= hoje      → PENDENTE
```

O registro **não** é reescrito só porque a data passou — comparação lexical válida no formato `AAAA-MM-DD`, com `hoje` local. `PAGA` não existe nesta subfase.

## Cancelamento

`status = cancelada` + `cancelado_em = agora`. Conta cancelada é terminal: não pode ser editada nem cancelada de novo. Cancelar não altera saldo, não cria transação, não altera carteira, não cria nova conta.

## Edição

Enquanto não cancelada: `referencia`, `descricao`, `valorEsperado`, `vencimento`. O `servicoId` e o jogador dono **não** podem ser alterados (preservam a identidade do registro). `atualizado_em` é renovado a cada escrita.

## Camadas

- **Domínio** (`src/core/dominio/conta.js`): puro, sem E/S — referência, datas, estados/situações, valores (via Fase 08), criação/edição, conversor `paraConta`;
- **Aplicação** (`src/core/aplicacao/servico-contas.js`): `criar / obter / listar / atualizar / cancelar` + `listarPendentes / listarVencidas / listarCanceladas` + `resumo`; valida jogador e vínculo com o serviço; anexa `situacao` derivada;
- **Persistência**: tabela `servico_conta` (migração 011, schema v11) + `RepositorioConta` — SQL somente no repositório;
- **IPC**: `conta:listar · conta:obter · conta:criar · conta:atualizar · conta:cancelar · conta:config` (sem IPC genérica de SQL; renderer nunca toca o SQLite);
- **Interface**: visão `CONTAS E DESPESAS` (lista com filtros TODAS/PENDENTES/VENCIDAS/CANCELADAS + filtro por serviço, detalhe, formulário) em `src/renderer/js/contas.js`.

## Testes

- **Unidade** (`tests/unidade/conta.test.mjs`): referência, vencimento, estados/situações, valores, criação/edição, conversor;
- **Integração** (`tests/integracao/conta.test.mjs`): cadastro → consulta → edição → cancelamento; vínculo com serviço (válido/inexistente/outro jogador); centavos; datas futura/pendente/vencida; filtros; isolamento por jogador; **teste financeiro obrigatório** (saldo R$ 1.000,00 inalterado + zero transações criadas); persistência fechar/reabrir.

## Limitações da subfase (deliberadas)

Sem recorrências, geração automática, pagamento, transações, alteração de carteira/saldo, orçamento, notificações/lembretes, calendário, juros/multas, parcelamentos, cartão, Open Finance ou pagamentos automáticos.
