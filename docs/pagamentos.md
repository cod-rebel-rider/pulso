# Pagamentos — PULSO

**Fase:** 10.5 — Pagamentos (implementada). Registra o **pagamento** de uma conta existente (`servico_conta`, Fases 10.2/10.4) e a transforma em uma **transação de despesa** real no sistema financeiro da Fase 08 — a única subfase do módulo de serviços que movimenta dinheiro.

> **Princípio:** registrar uma conta não movimenta dinheiro. Registrar o pagamento transforma a obrigação em uma transação financeira real.

## A diferença que importa (vocabulário canônico)

```text
CONTA      = obrigação registrada    (Internet · 2026-10 · vence 15/10 · R$ 120,00 pendente)
PAGAMENTO  = realização da obrigação (ato de pagar: valor real, data, observação)
TRANSAÇÃO  = registro financeiro     (DESPESA pelo valor pago, categoria `contas`)
CARTEIRA   = consequência financeira (saldo cai pelo mecanismo da Fase 08, nunca por SQL direto)
```

## Fluxo

```text
CONTA (pendente/vencida)
   ↓  registrarPagamento
PAGAMENTO (valor pago, paid_at, observação opcional)
   ↓
TRANSAÇÃO DE DESPESA (Fase 08)
   ↓
CARTEIRA / SALDO (atualizados pelo fluxo financeiro existente)
```

## Regras do pagamento

- a conta precisa estar **PENDENTE** ou **VENCIDA** (`vencida` é situação **derivada** da Fase 10.2 — o estado persistido é `pendente`); são rejeitadas: inexistente, cancelada, já paga e conta de outro jogador;
- o **valor pago** vem em centavos inteiros e pode **diferir** do `valor_esperado_centavos` — a despesa registra o valor REAL, nunca o esperado;
- `paid_at` é data civil `AAAA-MM-DD`; observação opcional (máx. 500 caracteres);
- a despesa usa a categoria financeira **`contas`** (compatível com a Fase 08);
- a conta vira **`PAGA`** e passa a guardar `paid_amount`, `paid_at`, `payment_description` e `transaction_id` (vínculo CONTA → TRANSAÇÃO);
- tudo em **uma única transação SQLite**: se qualquer etapa falha, `ROLLBACK` — a conta continua pendente/vencida, o saldo fica intacto e nenhuma transação parcial permanece.

```text
Conta R$ 120,00 → pagamento R$ 125,00 → DESPESA −R$ 125,00 → carteira −R$ 125,00

Saldo: R$ 1000,00 · conta: R$ 120,00 · pago: R$ 125,00
Resultado: saldo R$ 875,00 · conta PAGA · transação DESPESA de R$ 125,00
```

## Idempotência (uma conta, um pagamento)

- `PAGA` é estado **terminal** nesta fase: nova tentativa é bloqueada **antes** de tocar o financeiro — nenhuma segunda transação, nenhum débito duplicado;
- cada transação financeira só pode estar vinculada a **uma** conta (índice único parcial em `transaction_id`);
- **estorno** não é implementado aqui (fase futura): enquanto isso, a conta paga permanece paga.

## Banco (migração 014, schema v14)

O SQLite não altera `CHECK` por `ALTER TABLE`, e a migração 011 limitava `estado` a `pendente`/`cancelada`. Por isso `servico_conta` é **reconstruída** no formato completo (padrão da conciliação da v9), preservando todas as linhas, a unicidade `(servico_id, referencia)` que sustenta a idempotência da geração (10.4) e o `recorrencia_id`:

- `estado` passa a aceitar **`paga`**, com `CHECK estado <> 'paga' OR (paid_amount IS NOT NULL AND paid_at IS NOT NULL)` — conta paga sempre tem desfecho completo;
- `paid_amount INTEGER` (> 0) — o valor REALMENTE pago; `paid_at TEXT` (`AAAA-MM-DD`); `payment_description TEXT`;
- `transaction_id INTEGER REFERENCES transacao(id) ON DELETE SET NULL` + índice único parcial — excluir a transação no financeiro **não** desfaz a conta paga, apenas solta o vínculo.

## IPC

Canal **`conta:pagar`** (preload `conta.pagar`): `{ jogadorId, id, valorPagoCentavos, paidAt, paymentDescription? }` → `{ ok, conta, transacao, resumo }`. Erros de validação/conflito do domínio viram `{ ok: false, erro }` — nunca exceção estourada ao renderer.

## Interface

- no **detalhe da conta** (`pendente`/`vencida`): ação **REGISTRAR PAGAMENTO** solicita valor pago, data e observação opcional; após pagar, o detalhe exibe status `PAGA`, valor esperado × valor pago, data e a transação relacionada;
- contas `PAGA` não oferecem mais a ação de pagamento;
- listagem com filtro: **TODAS · PENDENTES · VENCIDAS · PAGAS · CANCELADAS**.

## O que este pagamento NÃO faz

- **não estorna** (fase futura);
- **não altera** o valor esperado, a competência nem o vencimento da conta;
- **não gera** contas (Fase 10.4) e **não cria** contas pagas do nada — só paga conta existente;
- **nunca** toca `carteira` por SQL direto: o saldo muda exclusivamente pela `criarTransacao` da Fase 08.

## Testes

`tests/unidade/pagamento.test.mjs` (regras puras) e `tests/integracao/pagamento.test.mjs` (banco real) cobrem: pagamento de pendente e vencida, valor diferente do esperado, criação da despesa, saldo correto, vínculo conta↔transação, pagamento duplicado, cancelada, inexistente, jogador incorreto, valor/data inválidos, **atomicidade** com falha simulada na despesa, isolamento entre jogadores e persistência fechar → reabrir. Detalhes em `docs/testes.md` (seção 3.10).
