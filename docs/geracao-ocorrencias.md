# Geração de Ocorrências — PULSO

**Fase:** 10.4 — Geração de Ocorrências (implementada). Transforma a **regra** (Recorrência, Fase 10.3) em **contas concretas** (entidade `servico_conta`, Fase 10.2) dentro de um período informado — geração **manual**, pelo usuário, na tela de recorrências.

> **Princípio:** a recorrência define o padrão. A geração transforma o padrão em contas reais. O dinheiro só entra no fluxo quando houver pagamento.

## A diferença que importa (vocabulário canônico)

```text
RECORRÊNCIA = regra      (mensal, vence dia 15, R$ 120,00 — nunca vira dinheiro)
OCORRÊNCIA  = conta concreta  (Internet · 2026-10 · vence 15/10/2026 · R$ 120,00 pendente)
GERAÇÃO     = processo que transforma a regra em ocorrências
PAGAMENTO   = Fase 10.5 (única subfase que cria transação e movimenta saldo)
```

Gerar **não** paga, **não** cria transação financeira, **não** altera carteira, **não** altera saldo e **não** altera orçamento. Toda conta gerada nasce `PENDENTE`; o estado `vencida` continua sendo **derivado** pelas regras da Fase 10.2 (`situacaoConta`) — nada é reescrito porque a data passou.

```text
Saldo antes: R$ 1000,00
Gerar 3 contas de R$ 120,00
Saldo depois: R$ 1000,00
```

As contas representam **obrigações registradas**, não dinheiro já gasto.

## Como a geração funciona

1. O usuário abre o **detalhe da recorrência** e escolhe **GERAR OCORRÊNCIAS** com um período (`De` / `Até`, ambos obrigatórios e inclusivos);
2. o domínio calcula as ocorrências válidas no período;
3. para cada ocorrência, se ainda **não existe** conta do mesmo serviço naquela competência, uma conta `pendente` é criada; se já existe (gerada antes ou lançada à mão), ela é apenas **contada** como "já existente";
4. a interface exibe o resultado:

```text
Ocorrências encontradas: 3
Novas contas criadas: 2
Já existentes: 1
```

### Cálculo das datas

- a **âncora** da sequência é o **mês** de `data_inicio` da regra; cada passo avança o intervalo da frequência (mensal=1, bimestral=2, trimestral=3, semestral=6, anual=12 meses) — a cadência nunca muda e meses fora da janela são filtrados, não "recuperados" em lote;
- o vencimento de cada ocorrência usa a regra canônica de **meses com dias diferentes** (Fase 10.3): dia 31 em fevereiro → 28 (29 em bissexto); nenhuma ocorrência é descartada nem empurrada para o mês seguinte;
- a ocorrência é válida quando o **vencimento (data real)** respeita a validade da regra (`dataInicio` ≤ vencimento ≤ `dataFim`, quando há término) **e** cai dentro do período pedido — inclusive nas duas pontas;
- não existem datas inválidas nem deslocamentos inconsistentes: o dia 31 nunca vira "5 de março".

### Idempotência

A identidade de uma ocorrência é **(servico_id, referencia `AAAA-MM`)** — a MESMA unicidade da Fase 10.2 (`UNIQUE` no banco). Consequências:

```text
Gerar ocorrência       → Conta criada
Executar geração de novo → NÃO duplica (contada como "já existente")
```

A conta gerada guarda `recorrencia_id` (migração 013) para rastreabilidade — contas manuais ficam com `NULL`.

### Cópia do valor

O `valor_esperado` da conta é **copiado da recorrência no momento da geração**. Alterar a regra depois (valor, dia, período) **não** altera contas já geradas; a próxima geração usa o valor **vigente** no momento.

## Estados que geram

| Estado da recorrência | Gera? |
| --- | --- |
| `ATIVA` | sim |
| `INATIVA` | não — regra pausada (`ErroValidacao`: "reative-a antes") |
| `ARQUIVADA` | não — regra encerrada (`ErroValidacao`) |

Recorrência inexistente → `ErroConflito`. Período invertido, com data inexistente ou incompleto → `ErroValidacao`. Nenhuma tentativa falha cria contas pela metade: a geração roda dentro de uma transação SQLite (`comTransacao`).

## Camadas

- **Domínio** (`src/core/dominio/geracao.js`): puro, sem E/S — `validarPeriodoGeracao`, `podeGerarOcorrencias`, `calcularOcorrencias` (âncora + frequência + regra de meses curtos);
- **Aplicação** (`src/core/aplicacao/servico-geracao-ocorrencias.js`): `gerar(recorrenciaId, { periodoInicio, periodoFim })` → `{ encontradas, criadas, existentes, contas }`; valida estado, calcula, decide criar/pular e anexa a situação derivada da Fase 10.2; transacional;
- **Persistência**: `servico_conta` ganha `recorrencia_id` (migração 013, schema v13) — a tabela de contas **não muda de formato** além da coluna nova; `RepositorioConta` grava e devolve o vínculo;
- **IPC**: canal `recorrencia:gerar` (canais.cjs + preload.cjs + main.js) — sem IPC genérica de SQL;
- **Interface**: seção **GERAR OCORRÊNCIAS** no detalhe da recorrência (`src/renderer/js/recorrencias.js`), exibida apenas para regras `ATIVA`, com `De`/`Até` e o resultado com três métricas.

## Testes

- **Unidade** (`tests/unidade/geracao.test.mjs`, 14 testes): período (obrigatório, inclusivo, invertido, data inexistente), elegibilidade (só ATIVA), mensal/bimestral/trimestral/semestral/anual, start_date, end_date, período limitado, comparação pela data do vencimento, meses curtos (28/29/30/31), validações, resultado congelado;
- **Integração** (`tests/integracao/geracao.test.mjs`, 11 testes): ciclo completo com banco real — geração mensal completa (valor copiado, vínculo, pendente, persistência), idempotência (repetida e sobreposta), duplicidade com conta manual preservada, todas as frequências, start/end, meses curtos com bissexto, estados inativa/arquivada/inexistente/período inválido, valor vigente para gerações futuras, isolamento por jogador, **teste obrigatório** (3 contas de R$ 120,00 → saldo R$ 1.000,00 inalterado, zero transações) e persistência fechar → reabrir → regerar sem duplicar.

## Limitações da subfase (deliberadas)

Sem geração automática/agendada (nada roda "no abrir do app" — a geração é sempre manual e por período), sem pagamento, sem transações financeiras, sem alteração de carteira/saldo/orçamento, sem notificações, sem lembretes, sem juros/multas, sem parcelamentos, sem cartão. Pagamento é a **Fase 10.5**.
