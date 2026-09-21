# Recorrências — PULSO

**Fase:** 10.3 — Recorrências (implementada). Define a **regra de repetição** de um **Serviço** (estrutura permanente, Fase 10.1) — sem gerar nenhuma conta.

> **Princípio:** a recorrência **não é uma conta**. É a regra que ensina o PULSO a saber **quando** uma nova conta poderá existir. Nesta subfase: `Recorrência criada → Regra armazenada → NENHUMA CONTA É GERADA`. Criar, editar, ativar, desativar ou arquivar **não** cria conta, **não** cria transação financeira e **não** altera carteira ou saldo.

## Conceito — SERVIÇO × RECORRÊNCIA × CONTA

```text
SERVIÇO      = estrutura permanente (ex.: Internet — Fase 10.1)
   ↓
RECORRÊNCIA  = regra de repetição (ex.: mensal, vence dia 15, R$ 120,00 — Fase 10.3)
   ↓
CONTA        = ocorrência concreta (ex.: Internet · 2026-09 · vence 15/09 — Fase 10.2 manual;
               Fase 10.4 gera ocorrências a partir da regra)
   ↓
PAGAMENTO    = futura operação financeira (Fase 10.5)
```

## Campos da recorrência

| Campo | Regras |
| --- | --- |
| `servicoId` | obrigatório; o serviço precisa existir **e** pertencer ao mesmo jogador (`ErroConflito` se inexistente; `ErroValidacao` se de outro jogador) |
| `frequencia` | lista controlada: `mensal` · `bimestral` · `trimestral` · `semestral` · `anual` (extensível — cada frequência declara o intervalo em meses; novas entram na lista do domínio, sem refazer o sistema) |
| `dataInicio` | obrigatória; data civil `AAAA-MM-DD` com rejeição de datas inexistentes (ex.: `2026-02-30`) |
| `dataFim` | opcional; quando informada, **não pode ser anterior** ao início |
| `diaVencimento` | dia do mês `1–31` ancorado à regra |
| `valorEsperado` | inteiro em **centavos, > 0** — reutiliza `validarValorCentavos` da Fase 08; é a **expectativa** da regra, não dinheiro gasto |
| `descricao` | opcional, até 2000 caracteres (`null` quando vazia) |
| `estado` | persistido: `ativa` · `inativa` · `arquivada` (nasce `ativa`) |
| `arquivadoEm` | preenchido no arquivamento; o registro nunca é apagado |

## Estados (máquina de estados)

```text
ATIVA → INATIVA | ARQUIVADA
INATIVA → ATIVA | ARQUIVADA
ARQUIVADA → (terminal nesta subfase — não reativa, não edita)
```

A recorrência nasce `ATIVA`; desativar e reativar são livres; **arquivar é terminal** — operações em arquivadas são recusadas (`ErroValidacao`/`ErroTransicao`).

## Meses com quantidades diferentes de dias (regra canônica)

Quando o mês não tem o dia da regra, a ocorrência correspondente usa o **último dia válido do mês** — nunca é descartada e nunca é empurrada para o mês seguinte:

```text
mensal, vence dia 31:
  janeiro → 31   fevereiro/2026 → 28   fevereiro/2024 → 29 (bissexto)
  abril → 30     junho → 30            novembro → 30
```

Implementado em `ajustarDiaNoMes` / `dataComDiaAjustado` (puro, sem E/S) — a **geração** das ocorrências que usam essa regra pertence à Fase 10.4.

## Camadas

- **Domínio** (`src/core/dominio/recorrencia.js`): puro, sem E/S — frequências com intervalo em meses, máquina de estados, datas civis, último dia do mês, criação/edição, conversor `paraRecorrencia`;
- **Aplicação** (`src/core/aplicacao/servico-recorrencias.js`): `criar / obter / listar / atualizar / ativar / desativar / arquivar` + `listarAtivas / listarInativas / listarArquivadas` + `resumo`; valida jogador e vínculo com o serviço; nada financeiro;
- **Persistência**: tabela `servico_recorrencia` (migração 012, schema v12) + `RepositorioRecorrencia` — SQL somente no repositório;
- **IPC**: `recorrencia:listar · recorrencia:obter · recorrencia:criar · recorrencia:atualizar · recorrencia:ativar · recorrencia:desativar · recorrencia:arquivar · recorrencia:config` (sem IPC genérica de SQL; renderer nunca toca o SQLite);
- **Interface**: visão `RECORRÊNCIAS` (`src/renderer/js/recorrencias.js`) — lista com filtros **TODAS / ATIVAS / INATIVAS / ARQUIVADAS** + filtro por serviço, detalhe (serviço, frequência, início, término, vencimento, valor esperado, status) e formulário de criação/edição.

## Edição

Enquanto não arquivada: `frequencia`, `dataInicio`, `dataFim`, `diaVencimento`, `valorEsperado`, `descricao` (o período é revalidado com os campos finais combinados). `servicoId`, jogador dono e `estado` **não** mudam por edição — o estado muda apenas por ações de domínio (ativar/desativar/arquivar). `atualizado_em` é renovado a cada escrita.

## Testes

- **Unidade** (`tests/unidade/recorrencia.test.mjs`, 15 testes): frequências e extensibilidade, máquina de estados, datas civis, último dia do mês (bissextos), ajuste do dia 31, valores, período, criação/edição, conversor;
- **Integração** (`tests/integracao/recorrencia.test.mjs`, 8 testes): criar→consultar→editar; ativar/desativar/arquivar; vínculo com serviço (inexistente/outro jogador); datas, frequência e valor inválidos; isolamento por jogador e filtros; regras mensal/anual com dia 31; **teste financeiro obrigatório** (criar/editar/ativar recorrência de R$ 120,00 — saldo inalterado, zero contas, zero transações); persistência fechar/reabrir.

## Limitações da subfase (deliberadas)

Sem geração automática de contas (Fase 10.4), pagamento, transações, alteração de carteira/saldo, notificações, lembretes, calendário, juros/multas, parcelamentos, cartão, Open Finance ou integrações externas.
