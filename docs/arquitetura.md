# Arquitetura — PULSO

**Fase:** 00 — Preparação (documentação inicial; nada implementado além da estrutura).

## 1. Visão geral

O PULSO é uma aplicação desktop local-first organizada em camadas com dependência **unidirecional**:

```text
┌──────────────────────────────────────────────┐
│ interface      (src/renderer)                │  o que o usuário vê e usa
└───────────────┬──────────────────────────────┘
                ↓  (IPC — Fase 01)
┌──────────────────────────────────────────────┐
│ aplicação      (src/main + src/core/aplicacao) │  orquestra casos de uso
└───────────────┬──────────────────────────────┘
                ↓
┌──────────────────────────────────────────────┐
│ domínio        (src/core/dominio)            │  regras de negócio (XP, missões, finanças…)
└───────────────┬──────────────────────────────┘
                ↓
┌──────────────────────────────────────────────┐
│ persistência   (src/core/persistencia + database/) │  SQLite (Fase 02)
└──────────────────────────────────────────────┘
```

Regras estruturais:

1. Cada camada só conhece a camada imediatamente abaixo.
2. A interface **nunca** acessa banco de dados, arquivos ou recursos do SO diretamente — sempre via camada de aplicação.
3. O **domínio é puro**: sem Electron, sem SQLite, sem dependência de interface — por isso é testável de forma isolada.
4. Módulos de funcionalidade vivem em `src/modules/<modulo>` e conversam com o núcleo por interfaces explícitas, nunca "por baixo".

## 2. Responsabilidades por camada

| Camada | Diretório | Responsabilidade |
| --- | --- | --- |
| Interface | `src/renderer` | Telas, componentes, estilos, feedback visual |
| Processo principal | `src/main` | Ciclo de vida do aplicativo, janela, ponte IPC, integração com o SO |
| Domínio | `src/core/dominio` | **Iniciado (Fase 03)**: `jogador.js` (identidade) · **Fase 04**: `status.js` (regras de estado) · **Fase 05**: `missao.js` (regras de missão, máquina de estados) · **Fase 06**: `progressao.js` · **Fase 07**: `projeto.js` · **Fase 08**: `financa.js` (valores em centavos, categorias, saldo, orçamento) · **Fase 09**: `loja.js` (desejo, máquina de estados, comparação esperado × pago) · **Fase 10.2**: `conta.js` (ocorrência de serviço: referência `AAAA-MM`, vencimento, estado persistido × situação derivada `VENCIDA`, valores via Fase 08) · **Fase 10.3**: `recorrencia.js` (regra de repetição: frequências com intervalo em meses, máquina de estados ativa/inativa/arquivada, datas civis, último dia do mês para meses menores) · **Fase 10.4**: `geracao.js` (cálculo puro das ocorrências: âncora no mês de `dataInicio`, passo pela frequência, interseção da validade da regra com o período pedido, regra de meses curtos) · **Fase 10.5**: `pagamento.js` (validação do ato de pagar: estados pagáveis — pendente/vencida sim, cancelada/já paga nunca; isolamento por dono; valor pago em centavos podendo diferir do esperado; data civil; situação de pagamento derivada `PAGO`/`A_PAGAR`) · **Fase 15**: `dashboard.js` (consolidação: agrega e transforma dados dos módulos existentes para a visão do painel; não cria regras nem entidades; Fonte dos dados = módulos existentes) |
| Aplicação | `src/core/aplicacao` | **Iniciado (Fase 03)**: `servico-jogador.js` · **Fase 04**: `servico-status.js` · **Fase 05**: `servico-missao.js` · **Fase 06**: `servico-progressao.js` · **Fase 07**: `servico-projeto.js` · **Fase 08**: `servico-financa.js` (carteira, transações, orçamentos) · **Fase 09**: `servico-loja.js` (lista de desejos, compra atômica via Fase 08) · **Fase 10.2**: `servico-contas.js` (contas sem efeito financeiro: criar/obter/listar/atualizar/cancelar + filtros por situação derivada) · **Fase 10.3**: `servico-recorrencias.js` (regra de repetição sem efeito financeiro: criar/obter/listar/atualizar/ativar/desativar/arquivar + filtros por estado; valida vínculo jogador↔serviço) · **Fase 10.4**: `servico-geracao-ocorrencias.js` (transforma a regra em contas pendentes num período; idempotente por (servico, referência); cópia do valor no momento; transacional; sem efeito financeiro) · **Fase 10.5**: `servico-pagamentos.js` (paga uma conta existente e a transforma em DESPESA real via `ServicoFinanca` da Fase 08; valor pago pode diferir do esperado; idempotente por estado `PAGA`; atômico numa única transação SQLite; carteira nunca tocada por SQL direto) · **Fase 15**: `servico-dashboard.js` (orquestra consultas específicas/agregadas para a visão consolidada; nenhuma regra nova; reusa Fases 03–10; Fase 15 = camada de consolidação, Fonte dos dados = módulos existentes) |
| Persistência | `src/core/database` | **Implementada (Fase 02)**: conexão SQLite, migrações, repositórios |
| Módulos | `src/modules` | Funcionalidades independentes com contrato público documentado |

## 3. Comunicação

- **Interface ↔ núcleo:** via IPC do Electron (a partir da Fase 01), com canais nomeados por módulo e mensagens estruturadas (ex.: canal `missao:listar`). O renderer recebe apenas dados já processados.
- **Módulo ↔ módulo:** preferencialmente indireto, por meio da camada de aplicação. Acoplamento direto entre módulos deve ser evitado; quando necessário, deve estar explícito no contrato do módulo.
- **Núcleo ↔ banco:** exclusivamente pela camada de persistência (`src/core/database/`), por meio de repositórios — **implementado na Fase 02** (conexão, migrações) e estendido na Fase 03 (`RepositorioJogador`);
- **Domínio validando com regras próprias:** desde a Fase 03, a identidade do jogador é validada em `src/core/dominio/jogador.js` (puro, testável) antes de persistir;

## 4. Módulos previstos

**Implementados:** Jogador (Fase 03) · Status (Fase 04) · Missões (Fase 05) · Progressão (Fase 06) · Projetos (Fase 07) · **Finanças (Fase 08)** · **Loja / Lista de Desejos (Fase 09)** · **Serviços (Fase 10.1)** · **Contas / Despesas (Fase 10.2)** · **Recorrências (Fase 10.3)** · **Pagamentos (Fase 10.5)** — cada um com domínio próprio, casos de uso próprios, contrato IPC documentado e testes próprios. A Loja não tem carteira própria: toda movimentação financeira da compra passa pelo serviço da Fase 08 (ver ADR-011). As Contas não têm efeito financeiro algum: criar/editar/cancelar nunca cria transação nem altera saldo (ver `docs/contas-despesas.md`). As Recorrências são apenas **regra de repetição**: criar/editar/ativar/desativar/arquivar não gera conta, não cria transação e não altera saldo (ver `docs/recorrencias.md`). O **Pagamento** é o único ponto do módulo de serviços que movimenta dinheiro: CONTA → DESPESA → CARTEIRA, sempre dentro do mecanismo da Fase 08, atômico e sem duplicidade (ver `docs/pagamentos.md`).

**Planejados (nenhum implementado):** `Habilidades · Música · Mapa · Conquistas`

Quando implementados, cada módulo deverá ter: domínio próprio, casos de uso próprios, contrato público documentado e testes próprios. A granularidade exata será decidida fase a fase.

## 5. Decisões técnicas (registro de decisões — ADR)

### ADR-001 — Electron como plataforma desktop

**Decisão:** manter **Electron + HTML/CSS/JavaScript**, conforme o planejamento original.

**Vantagens:** runtime web completo para a interface Cyberpunk pretendida (animações, canvas, WebGL); acesso nativo a arquivos e ao SO; SQLite funciona bem via drivers Node; empacotamento maduro para Linux e Windows (necessário na Fase 18, inclusive executável para pendrive); comunidade e documentação abundantes; um único código para os dois sistemas.

**Desvantagens:** consumo maior de memória e disco (binário grande); inicialização mais lenta que aplicativos nativos; exige disciplina de segurança (sem integração Node no renderer, com isolamento de contexto).

**Impacto:**

- **Linux (foco atual):** excelente suporte (AppImage/deb/tar.gz); desenvolvimento direto no Ubuntu.
- **Windows (Fase 18):** o mesmo código gera o pacote Windows, sem retrabalho.
- **Pendrive (Fase 18):** Electron permite builds portáteis; os caminhos de dados serão abstraídos desde cedo para não quebrar nesse cenário.
- **SQLite:** maduro via drivers Node (decisão do driver na Fase 02 — ver `banco-de-dados.md`).
- **Manutenção:** stack única (JavaScript) de ponta a ponta; o Electron atualiza com frequência e as versões precisam ser acompanhadas.

**Alternativas avaliadas:**

| Alternativa | Prós | Contras | Veredito |
| --- | --- | --- | --- |
| Tauri (Rust) | binário ~10 MB, muito leve | exige toolchain Rust; webview varia por SO; SQLite via plugin; curva extra para projeto solo em JS | descartada — complexidade sem ganho essencial |
| NW.js | similar ao Electron | comunidade em declínio | descartada |
| Web app + servidor Node local | leve, sem empacotar browser | experiência menos integrada; gestão de porta/servidor; UX de janela pior | descartada |
| Nativo (GTK/Qt) | desempenho e leveza | stack diferente de web; desenvolvimento mais lento para a interface rica pretendida | descartada |

### ADR-002 — JavaScript moderno (ESM) e framework de interface

- Projeto com `"type": "module"` e sintaxe ESM em todo o código. **Exceção:** o `preload.cjs` é CommonJS, pois o sandbox do Electron não suporta ESM nem `require` de arquivos locais no preload (ver ADR-005).
- **Resolvido na Fase 01 (ver ADR-006):** a fundação usa JavaScript vanilla (sem framework de UI).

### ADR-003 — SQLite como persistência (a partir da Fase 02)

- Banco em arquivo único, sem servidor — ideal para local-first. Detalhes e pendências em `banco-de-dados.md`.

### ADR-004 — Runner de testes nativo (`node:test`)

- Zero dependências externas além do Electron; reavaliar apenas se a Fase 01+ trouxer necessidade real.

### ADR-005 — Preload em CommonJS com sandbox ativado (Fase 01)

**Decisão:** `src/main/preload.cjs` em CommonJS + `sandbox: true`.

**Motivo:** no Electron, preload scripts em ESM exigem desativar o sandbox. Como a segurança da fundação tem prioridade (seção 7), mantivemos o sandbox e escrevemos o preload em CJS. Limitação decorrente: preload em sandbox não pode `require` arquivos locais, então os nomes de canais IPC são replicados manualmente entre `canais.cjs` (main) e `preload.cjs` — os testes unitários verificam essa sincronia.

### ADR-006 — Interface da fundação em JavaScript vanilla (Fase 01)

**Decisão:** HTML + CSS + JS puros na tela de fundação, sem framework (React, Vue, Svelte etc.).

**Motivo:** a tela inicial é pequena e o custo de um framework não se justifica ainda. A arquitetura em camadas isola essa decisão no `src/renderer` — se a complexidade das próximas fases pedir um framework, a fundação não precisará ser desmontada. Pendência P-002 resolvida.

### ADR-007 — Teste de fumaça nativo para validação da inicialização (Fase 01)

**Decisão:** o processo principal aceita a flag `--teste-fumaca`: inicia, cria a janela, carrega o renderer, valida a IPC, coleta erros de console, imprime um relatório JSON (`PULSO_FUMACA:{...}`) e encerra sozinho. Os testes de integração (`node:test`) executam dois ciclos completos (inicia → encerra → inicia de novo).

**Motivo:** valida os Testes 1–8 da Fase 01 sem depender de ferramentas externas (Playwright continua pendente para a Fase 17 — P-006).

### ADR-008 — Fixação do Electron 37.x (incompatibilidade do 41.x no ambiente atual)

**Decisão:** usar Electron **37.10.3** (fixado em `package.json`).

**Problema encontrado:** o Electron 41.7.1 (e 39.x) sofre **SIGSEGV** no início da execução neste ambiente (Ubuntu 26.04, glibc 2.43, kernel 7.0) — confirmado com um aplicativo mínimo de 10 linhas, com e sem `--no-sandbox`/`--disable-gpu`/Wayland nativo; o registro do kernel aponta falha consistente no binário (`segfault at 0`). O Electron 37.10.3 funciona sem contornos.

**Consequência:** upgrade do Electron maior requer reteste neste sistema (o teste de fumaça automatizado serve exatamente para isso). Registrado em `pendencias.md` (P-016).

### ADR-009 — Persistência com `node:sqlite` nativo (Fase 02)

**Decisão:** camada de persistência com o módulo **`node:sqlite`** do Node embutido no Electron (SQLite 3.50.4), sem dependências externas.

**Motivos:** `better-sqlite3` (principal alternativa) exige rebuild nativo para a ABI do Electron a cada versão — atrito constante de manutenção; `node:sqlite` é síncrono, suficiente para o perfil local-first de aplicação pessoal, e roda identicamente na aplicação e na suíte de testes. Comparação completa em `banco-de-dados.md`. Risco aceito e documentado: módulo experimental no Node 22 (impacto confinado a `conexao.js`; `better-sqlite3` permanece o plano B).

**Consequências:** suíte de testes roda com o runtime do Electron (`ELECTRON_RUN_AS_NODE=1 electron --test`); tabelas `STRICT` habilitadas; repositórios isolam o SQL das demais camadas.

### ADR-010 — Núcleo financeiro em centavos inteiros e saldo derivado (Fase 08)

**Decisão:** valores monetários armazenados como **inteiros de centavos** (R$ 1.250,75 → `125075`), nunca `float`/`double`; moeda centralizada em `MOEDA` (`BRL`) no domínio. **Nenhum** saldo é armazenado: saldo, resumos por período e situação de orçamentos são **sempre recalculados** a partir do conjunto persistido de transações.

**Motivos:** elimina erros de arredondamento em binário; garante a invariante "saldo = resultado do histórico" (não há valor editável para dessincronizar); consultas agregam poucos registros (perfil local-first, uma carteira).

**Consequências:** regra única de saldo em `src/core/dominio/financa.js` (`calcularResumo`) e aplicada via `ServicoFinanca`; a interface formata (`R$ 1.234,56`) mas nunca calcula saldo; orçamentos comparam apenas limite planejado × despesas reais do período (limites inclusivos). Saldo negativo é permitido e apenas sinalizado — o sistema registra a realidade financeira, não a controla à força. Múltiplas carteiras, TRANSFERÊNCIA, auditoria persistida de exclusões e categorias personalizadas ficam como pendências registradas (arquitetura já preparada).

### ADR-011 — Compra da Loja atômica via ServicoFinanca (Fase 09)

**Decisão:** a Loja **não possui carteira nem lógica monetária própria**. O registro da compra (`ServicoLoja.comprar`) roda dentro de uma transação SQLite (`BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`, via `comTransacao`) que: (1) cria a despesa **exclusivamente** por `ServicoFinanca.criarTransacao` (categoria roteada de `MAPA_CATEGORIA_FINANCEIRA`, descrição `Compra: <título>`); (2) marca o desejo como `COMPRADO` com preço final, diferença, data e `transacao_id` (referência rastreável à transação financeira, `ON DELETE SET NULL`). Qualquer falha em qualquer passo desfaz tudo — nunca fica um item comprado sem despesa, nem despesa sem item comprado.

**Motivos:** o desejo é planejamento e não movimenta dinheiro; só a compra é realidade — e a realidade deve passar pelo motor financeiro da Fase 08 (saldo derivado das transações, orçamentos recalculados). Roteamento de categoria em vez de duplicar categorias financeiras preserva o histórico compreensível sem criar um segundo sistema.

**Consequências:** a Loja nunca faz `wallet.balance -= valor` (saldo é derivado, ADR-010); saldo negativo não bloqueia a compra; recompra de item `COMPRADO` é bloqueada por máquina de estados; cancelamento não gera efeito financeiro. Sem estoque, marketplace, busca automática de preços, parcelamento, cartão, financiamento, assinaturas, notificações, XP por compra ou integração com missão — pendências/adiados conforme o roadmap.

## 6. Fundação implementada (Fase 01)

```text
npm start
  └─ src/main/main.js (processo principal, ESM)
       ├─ configuracao.js  → carrega config/<ambiente>.json (PULSO_AMBIENTE ou isPackaged)
       ├─ janela.js        → BrowserWindow segura + diagnósticos
       │     └─ carrega src/renderer/index.html (CSP restritiva)
       │           └─ js/principal.js → usa window.pulso
       │                 └─ preload.cjs (CJS, sandbox) → ipcRenderer.invoke
       ├─ canais.cjs       → nomes de canais IPC (único canal: info:sistema)
       ├─ registro.js      → log identificável no console ([PULSO][ISO][NÍVEL])
       └─ ciclo de vida    → instância única, window-all-closed, activate, erros globais
```

Pontos principais:

- **Janela segura:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`; exibida só após `ready-to-show` (sem flash branco); dimensões vindas da configuração.
- **IPC mínima:** um único canal (`info:sistema`) — o renderer lê informações reais do sistema; nenhum objeto de Node é exposto.
- **Renderer isolado:** CSP `default-src 'none'` com liberações explícitas para estilos/scripts locais e favicon em data-URI; sem rede.
- **Erros identificáveis:** `uncaughtException`/`unhandledRejection` no main (diálogo de erro fora do modo teste), `did-fail-load`, `render-process-gone`, `unresponsive` e erros de console do renderer todos registrados via `registro.js`.
- **Instância única:** `requestSingleInstanceLock` com foco na janela existente.

## 7. Preparação para a portabilidade (Fase 18 — nada implementado)

Para não fechar portas no futuro:

- caminhos de dados sempre resolvidos por abstração (diretório de dados do SO), nunca hardcoded;
- assets referenciados de forma relativa/empacotada;
- nenhuma dependência de rede para funções essenciais (offline-first);
- ferramenta de empacotamento (electron-builder / electron-forge) será escolhida na Fase 18.

## 8. Segurança (quando o Electron existir)

- `contextIsolation: true` e `nodeIntegration: false` no renderer;
- validação de tudo que cruza a barreira IPC;
- nenhuma credencial no repositório (ver `regras-do-projeto.md`).

**Implementado na Fase 01** (ver seção 6): sandbox ativado, preload em CJS com ponte mínima e CSP restritiva no renderer.
