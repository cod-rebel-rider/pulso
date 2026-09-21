# Testes — PULSO

## 1. Estratégia

Pirâmide clássica, respeitando o ritmo das fases:

1. **Unidade** — domínio e casos de uso puros (regras de XP, missões, cálculos financeiros). Rápidos e numerosos.
2. **Integração** — módulos + persistência real (SQLite em arquivo temporário), a partir da Fase 02; e, desde a Fase 01, o ciclo de inicialização da aplicação.
3. **Extremo a extremo (e2e)** — interface Electron automatizada com ferramenta dedicada; a decidir na Fase 17 (registrada em `pendencias.md`).

## 3. Infraestrutura atual (Fase 02)

- Runner: **`node:test`** executado com o **Node embutido do Electron** — `npm test` → `ELECTRON_RUN_AS_NODE=1 electron --test "tests/**/*.test.mjs"` (o `node:sqlite` exige o runtime da aplicação; o Node do sistema 20.x não o possui).
- Estrutura:

```text
tests/
├── unidade/      → ambiente, configuração, registro, canais IPC, conexão, migrações, jogador, status, missão, projeto, finança, loja, serviço, conta, recorrência, geração
└── integracao/   → inicialização da aplicação (fumaça), persistência real do banco, jogador, status, missão, projeto, finança, loja, serviço, conta, recorrência, geração
```

## 3.4 Fase 08 — Finanças

- `tests/unidade/financa.test.mjs` — regras puras do domínio: conversão e validação
  de centavos (zero, negativos, não inteiros, grandes valores), tipos de transação,
  categorias por tipo (compatíveis e incompatíveis), cálculo de saldo
  (`0+1000=1000`, `1000+500=1500`, `1500−300=1200`, `100−150=−50`), períodos
  inclusivos (`01/09` e `30/09` dentro; `31/08` e `01/10` fora) e situação de
  orçamento (0/600→600; 420/600→180; 650/600→−50 estourado).
- `tests/integracao/financa.test.mjs` — ciclo completo com banco real: jogador →
  carteira → receitas/despesas → saldo → edição (recálculo) → exclusão →
  orçamentos (gasto por período, estouro, persistência) e ciclo
  salvar → fechar → reabrir → consultar.

## 3.5 Fase 09 — Loja / Lista de Desejos

- `tests/unidade/loja.test.mjs` — regras puras do domínio: máquina de estados do
  desejo (transições válidas e inválidas, terminalidade de COMPRADO/CANCELADO),
  validações de criação/edição/compra (nome, preços em centavos, categoria,
  prioridade), comparação esperado × pago (economia `1000/900 → −100 · −10%`,
  gasto acima `1000/1100 → +100 · +10%`), valores grandes sem perda de precisão,
  mapeamento de categoria do desejo → categoria financeira da Fase 08 e
  descrição da transação gerada.
- `tests/integracao/loja.test.mjs` — ciclo completo com banco real: criar →
  consultar → editar → persistir (reabrir banco); bloqueio de transições
  inválidas; **compra atômica** (despesa criada via Fase 08 + item marcado como
  COMPRADO + vínculo `transacaoId` + saldo atualizado; rollback quando o
  financeiro falha — nada fica meio-aplicado); histórico ordenado (mais
  recente primeiro); cancelamento sem transação e sem movimento de carteira;
  recompra bloqueada; cenário completo desejo → planejar → comprar → despesa →
  saldo → histórico.

## 3.6 Testes manuais — Fase 09 (executados)

Cenários da fase executados em banco SQLite temporário (ciclo completo, com reabertura do arquivo):

| # | Cenário | Resultado |
| --- | --- | --- |
| 1 | Criar desejo "SSD NVMe 1 TB" R$ 500,00 | status `DESEJADO`; carteira, saldo e histórico de transações **inalterados** |
| 2 | Editar preço esperado para R$ 450,00 (após `PLANEJADO`) | valor persistido; estado mantido |
| 3 | Registrar compra por R$ 399,90 | item `COMPRADO`; esperado R$ 450,00 · pago R$ 399,90 · **economia R$ 50,10**; despesa `Compra: SSD NVMe 1 TB` criada na Fase 08 |
| 4 | Consultar carteira | saldo reduzido em **R$ 399,90** (o pago), não em R$ 450,00 |
| 5 | Esperado R$ 100,00 · pago R$ 120,00 | diferença **+R$ 20,00** · **+10% acima do esperado** |
| 6 | Comprar novamente o mesmo item | **bloqueado** (`ErroTransicao` — item já comprado) |
| 7 | Cancelar um desejo | item permanece no banco (`CANCELADO`); nenhuma transação criada; carteira intacta |
| 8 | Fechar e reabrir o aplicativo (novo arquivo → reler) | histórico, estados e saldo **permanecem** |

## 3.7 Fase 10.3 — Recorrências

- `tests/unidade/recorrencia.test.mjs` — regras puras do domínio: lista controlada
  de frequências e extensibilidade (mensal…anual, cada uma com intervalo em meses),
  máquina de estados (nasce `ATIVA`; desativa/reativa; `ARQUIVADA` é terminal),
  datas civis (`AAAA-MM-DD`, datas inexistentes rejeitadas), último dia do mês
  (bissextos), **ajuste do dia 31 em meses menores** (fev → 28/29, abr/jun/nov → 30),
  valor esperado (centavos inteiros > 0), período (término ≥ início), criação e
  edição parciais, conversor linha → objeto.
- `tests/integracao/recorrencia.test.mjs` — ciclo completo com banco real:
  criar → consultar → editar → persistir; ativar/desativar/arquivar (arquivada é
  terminal: reativação e edição recusadas); vínculo com o serviço (inexistente ou
  de outro jogador recusado); validações de datas, frequência e valor; isolamento
  por jogador e filtros por estado/serviço; regras mensal e anual com dia 31;
  **teste financeiro obrigatório** (criar/editar/ativar recorrência de R$ 120,00 →
  saldo inalterado, **zero contas** e **zero transações** criadas); persistência
  fechar → reabrir.

## 3.8 Fase 10.4 — Geração de Ocorrências

- `tests/unidade/geracao.test.mjs` — regras puras do domínio: período De/Até
  (obrigatório, inclusivo, invertido e data inexistente rejeitados), elegibilidade
  (só recorrência `ATIVA` gera — inativa está pausada, arquivada encerrada),
  cálculo das ocorrências por frequência (mensal, bimestral, trimestral,
  semestral, anual com cadência ancorada no mês de `data_inicio`), respeito a
  `start_date`/`end_date`, período limitado, comparação pela DATA do vencimento
  (fim no dia 10 exclui a conta que vence dia 15) e **meses com menos dias**
  (dia 31 → fev 28/29, abr/jun/nov 30 — nunca descarta nem desloca).
- `tests/integracao/geracao.test.mjs` — ciclo completo com banco real:
  geração mensal (contas pendentes com valor copiado, vínculo `recorrencia_id`,
  serviço e jogador corretos, situação derivada da Fase 10.2); idempotência
  (mesma geração repetida → 0 novas / 3 existentes; período sobreposto → só os
  meses novos); duplicidade com conta manual preservada (não sobrescreve, não
  duplica); todas as frequências persistidas; `start_date`/`end_date` e períodos
  fora da validade; meses curtos com bissexto (fev/2024 → 29); recorrência
  inativa/arquivada/inexistente e período inválido recusados sem criar nada;
  valor vigente usado nas gerações futuras sem tocar nas contas antigas;
  isolamento por jogador; **teste financeiro obrigatório** (3 contas de R$ 120,00
  → saldo R$ 1.000,00 inalterado, carteira intacta, zero transações) e
  persistência fechar → reabrir → regerar sem duplicar.

## 3.9 Fase 10.5 — Pagamentos

- `tests/unidade/pagamento.test.mjs` — regras puras do domínio: estados
  pagáveis (`pendente`/`vencida` sim — vencida é a mesma conta `pendente` com
  vencimento no passado; cancelada/já paga/inexistente recusadas), isolamento
  por dono (conta de outro jogador recusada), valor pago em centavos inteiros
  > 0 (zero/negativo/decimal rejeitados), data civil `AAAA-MM-DD` (formato
  ruim/data inexistente rejeitadas), observação opcional truncada em 500 e
  situação de pagamento derivada (`pago`/`a_pagar`/`nao_aplicavel`).
- `tests/integracao/pagamento.test.mjs` — ciclo completo com banco real:
  pagamento de conta pendente e vencida (conta vira `PAGA` com `paid_amount`,
  `paid_at`, observação e `transaction_id`); **valor diferente do esperado**
  (esperado R$ 120, pago R$ 127,50 → despesa de R$ 127,50); **teste financeiro
  principal** (saldo R$ 1.000 → pago R$ 125 → saldo R$ 875, conta PAGA,
  transação DESPESA de R$ 125); vínculo conta↔transação consultável;
  **duplicidade bloqueada** (segunda tentativa não cria transação nem altera
  saldo); cancelada/inexistente/jogador errado/valor inválido recusados;
  **atomicidade** (falha simulada na criação da despesa → conta segue
  pendente, saldo intacto, nenhuma transação parcial); isolamento entre
  jogadores (pagar conta alheia não move carteira de ninguém) e
  **persistência** (fechar → reabrir o arquivo → conta continua PAGA com o
  vínculo e o saldo corretos).

## 4. Teste de fumaça (Fases 01–02)

O processo principal aceita a flag `--teste-fumaca`:

```bash
npx electron . --teste-fumaca
```

Ele inicia a aplicação, cria a janela, carrega o renderer, valida a ponte IPC, coleta erros de console do renderer, imprime `PULSO_FUMACA:{relatório JSON}` no stdout e encerra sozinho. Os testes de integração em `tests/integracao/inicializacao.test.mjs` executam **dois ciclos completos** (iniciar → encerrar → iniciar novamente), cobrindo:

1. dependências instaladas (Electron resolvível);
2. aplicação inicia;
3. janela criada;
4. renderer carregado;
5. HTML/CSS/JS carregam (sinal de prontidão do renderer, sem erros de console);
6. encerramento sem erros;
7. reinício após encerramento;
8. nenhum erro inesperado no console.

**Requisito de ambiente:** sessão gráfica (X11/Wayland) ou `xvfb-run` (`sudo apt install xvfb`) para execução headless.

## 5. Convenções

- arquivos de teste terminam em `.test.mjs`;
- descrições de teste em **português**;
- testes não dependem de rede nem de dados pessoais;
- configurações de teste usam `PULSO_AMBIENTE=teste` e `config/teste.json`.

## 6. O que testar por camada

| Camada | Tipo | Observação |
| --- | --- | --- |
| Domínio | unidade | funções puras, sem E/S |
| Aplicação | unidade/integração | casos de uso com repositórios simulados ou banco temporário |
| Persistência | integração | SQLite em arquivo temporário (Fase 02+) |
| Finanças (Fase 08) | unidade + integração | `financa.test.mjs` — domínio (centavos, categorias, saldo, período, orçamento) e ciclo completo com banco real (carteira, transações, edição/exclusão, orçamentos, persistência) |
| Loja / Lista de Desejos (Fase 09) | unidade + integração | `loja.test.mjs` — domínio (estados, transições, validações, diferença/percentual, mapeamento financeiro) e ciclo completo com banco real (compra atômica via Fase 08, rollback, histórico, cancelamento, persistência) |
| Recorrências (Fase 10.3) | unidade + integração | `recorrencia.test.mjs` — domínio (frequências, estados, datas, ajuste de dia 31, valores) e ciclo completo com banco real (vínculo com serviço, isolamento, filtros, arquivamento terminal, **saldo inalterado / zero contas / zero transações**, persistência) |
| Pagamentos (Fase 10.5) | unidade + integração | `pagamento.test.mjs` — domínio (estados pagáveis, isolamento por dono, valor/data, situação derivada) e ciclo completo com banco real (DESPESA via Fase 08, saldo correto, vínculo conta↔transação, duplicidade bloqueada, atomicidade com rollback, isolamento, persistência) |
| Processo principal + janela | integração | teste de fumaça (Fase 01) |
| Persistência (SQLite) | unidade + integração | conexão/PRAGMAs, migrações e ciclo salvar→reabrir→ler em bancos isolados (Fase 02) |
| Interface | e2e | automação dedicada (Fase 17) |

## 7. Regras

- **Não criar testes de funcionalidades que ainda não existem.**
- Cobertura de código: meta a definir na Fase 17 (o runner nativo oferece `--experimental-test-coverage` quando necessário).
- `npm test` deve sempre terminar sem erros em `dev`.
