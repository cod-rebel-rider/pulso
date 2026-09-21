# FASE 06 — AUDITORIA TÉCNICA

> **Natureza deste documento:** relatório de auditoria (leitura/análise). Nenhum
> arquivo de `src/`, `tests/` ou `config/` foi alterado para produzi-lo.
> **Fonte de verdade:** branch `dev`. A implementação histórica da Fase 06
> (`7473e06`) foi usada **apenas como referência semântica** — não foi restaurada.

## 1. Estado atual

**Branch:** `tarefa/fase-06-progressao-v2` — que é o **mesmo commit de `dev`, `origin/dev` e `origin/HEAD`** (decorations confirmadas em `git log --decorate`).
**Commit:** `a8591a2bf63575432d9847fd490c3b7782bc6c77` — *Merge pull request #11 from cod-rebel-rider/tarefa/fase-10-6-visao-estabilizacao*.
**Working tree:** limpo (`nothing to commit, working tree clean`); nenhuma alteração local; nenhum arquivo foi criado/modificado/excluído durante esta auditoria (`git status --short` vazio ao final).
**Ambiente:** Node do sistema `v20.20.2`; Electron `v37.10.3`; `node:sqlite` nativo; `npm test` → `ELECTRON_RUN_AS_NODE=1 electron --test "tests/**/*.test.mjs"`.
**Schema do banco:** **v14** (14 migrações em `src/core/database/migracoes.js:684-699`).
**Status geral:** árvore íntegra, suíte **345/345 testes verdes, 0 falhas** (`/tmp/pulso-testes.log` → `# pass 345 / # fail 0`, `EXIT=0`).

> Evidência de topologia (relevante para não restaurar código antigo):
> * `7de0ddb` (domínio+migração+serviço de progressão), `a426c3e` (merge da Fase 06) e `76990e9` (conciliação do legado, PR #4) **são ancestrais de `dev`**.
> * `7473e06` (`backup/fase-06-original-7473e06`, a "primeira implementação") **NÃO é ancestral de `dev`** — divergiu em `ca28801` (merge da Fase 05).
> Existem, portanto, **duas linhagens históricas**: a original abandonada (`7473e06`) e a reimplementação que efetivamente está em `dev` (`7de0ddb` → … → `a426c3e`).

## 2. Resumo executivo

A Fase 06 **está presente, integrada e funcionando em `dev`** — não está ausente. Existe o corte vertical completo: domínio puro (`src/core/dominio/progressao.js`), serviço de aplicação com transações (`servico-progressao.js`), dois repositórios, migração de schema (v5) + migração de conciliação de banco legado (v9), 3 canais IPC kebab-case, API `window.pulso.progressao`, painel PERSONAGEM no boot com barra de XP, pontos e 7 atributos, modal de LEVEL UP e 20 testes (13 unidade + 7 integração) que passam. A migração 009 já resolveu o conflito de banco criado pela implementação original (`7473e06`). O que resta não é "reconstruir a Fase 06": são **adequações** (decisão sobre teto de atributo, contrato uniforme, caminho de auto-recuperação não atômico, const drift de `ORIGENS_XP`, lacunas de documentação) e **itens explicitamente adiados** (XP por missão/projeto — P-022/P-024; respec — P-023), que pertencem a fases futuras.

## 3. Funcionalidades da Fase 06

| Funcionalidade | Estado | Local atual | Observação |
|---|---|---|---|
| Constantes iniciais (nível 1, 0 XP, 0 pontos, atributo 1) | Implementado | `dominio/progressao.js:13-17,179-185` | `NIVEL_INICIAL/XP_INICIAL/PONTOS_INICIAIS/VALOR_INICIAL_ATRIBUTO/PONTOS_POR_NIVEL` |
| Curva de XP `100 × nível` | Implementado | `dominio/progressao.js:49-54` | rejeita nível < 1 / não inteiro |
| Cálculo de nível pelo XP acumulado | Implementado | `dominio/progressao.js:79-88` | processa múltiplos níveis |
| Detalhe de progresso no nível | Implementado | `dominio/progressao.js:91-106` | `xpNoNivel`, `xpNecessario`, `progresso` (fração 0–1) |
| Concessão de XP | Implementado | `dominio/progressao.js:112-128` + `servico-progressao.js:111-138` | zero = no-op; negativo rejeitado; transacional |
| Level up múltiplo + pontos | Implementado | `dominio/progressao.js:112-128` | +1 ponto por nível; `subiuNivel`/`niveisGanhos` |
| 7 atributos + incremento com consumo de pontos | Implementado | `dominio/progressao.js:20-39,153-176` | atômico (atributos + pontos) |
| Validação de atributo inexistente | Implementado | `dominio/progressao.js:131-139` | `ErroValidacao` campo `atributo` |
| Bloqueio por pontos insuficientes | Implementado | `dominio/progressao.js:161-167` | `ErroValidacao` campo `pontos` |
| **Teto máximo de atributo (100)** | **Ausente (removido)** | — | existia em `7473e06` (domínio + `CHECK ... BETWEEN 1 AND 100`); **não existe em `dev`** |
| Garantia de jogador existente | Implementado | `servico-progressao.js:34-38` | `ErroConflito('Jogador não encontrado.')` |
| Origem do XP (MISSAO/PROJETO/CONQUISTA/OUTRO) | Parcial | `dominio/progressao.js:42` | constante declarada, **nenhum módulo consome** |
| Histórico/ledger de XP | Ausente | — | só o total acumulado (documentado) |
| Reset/respec de atributos | Ausente | — | P-023, adiado |
| Tabelas de banco | Implementado | `migracoes.js:127-161` (v5) | `jogador_progressao` + `jogador_atributos` |
| Conciliação de banco legado | Implementado | `migracoes.js:310-415` (v9) | idempotente, preserva dados, `nivel` derivado via `calcularNivel` |
| Inicialização atômica junto ao jogador | Implementado | `main.js:826-838` + `servico-jogador.js:53-59` | `aoCriar` dentro da transação do jogador |
| IPC (3 canais) | Implementado | `canais.cjs:25-27`; `main.js:396-419` | `progressao:obter/adicionar-xp/aumentar-atributo` |
| API do preload | Implementado | `preload.cjs:33-35,213-217` | `window.pulso.progressao.{obter,adicionarXp,aumentarAtributo}` |
| Painel PERSONAGEM (nível, barra, pontos, atributos +1) | Implementado | `index.html:82-98`; `principal.js:319-401`; `principal.css:490-594` | **embutido no boot** (a versão histórica tinha tela própria `#visao-progressao`) |
| Modal LEVEL UP | Implementado | `principal.js:403-426` | |
| Botão de teste `SIMULAR XP +50` | Implementado | `index.html:95`; `principal.js:1719` | sempre desocultado no boot |
| Recompensa de missão → XP | Ausente | — | P-022 (adiado, documentado) |
| Testes da fase | Implementado | `tests/unidade/progressao.test.mjs`; `tests/integracao/progressao.test.mjs` | 13 + 7 testes |

## 4. Domínio

### Implementado
Curva, nível, detalhe de progresso, concessão de XP com multi-level, validação de XP total/quantidade, 7 atributos nomeados/rotulados, distribuição de pontos e `atributosIniciais()`. Domínio **puro**: importa apenas `src/core/erros.js`; sem Electron, sem `node:sqlite`, sem DOM, sem IPC (`dominio/progressao.js:11`).

### Parcial
* `ORIGENS_XP` (`:42`) — constante congelada **sem consumidor** (grep em `src/`, `tests/`, `docs/` só encontra a declaração). Código morto hoje.
* `adicionarXp` retorna `pontosDisponiveis` acumulado sem limite superior (não há teto de pontos).
* `calcularNivel`/`calcularProgresso` são **O(nível)** (laço `while`); para XP muito alto o custo cresce linearmente no nível — irrelevante no uso atual, mas sem teste de teto/limite de magnitude.

### Ausente
* Teto máximo de atributo (histórico tinha `ATRIBUTO_MAXIMO = 100`, validado no domínio **e** no `CHECK` do banco).
* `calcularLevelUp` / `validarXp` / `validarValorAtributo` / `validarQuantidadePontos` / `criarAtributosIniciais` (nomes históricos) — a funcionalidade existe sob outros nomes/estrutura.
* Qualquer noção de **origem/causa** de XP, ledger, custo por nível, classe/papel, condição de pré-requisito.

### Incompatível
Nada. O domínio atual é autocontido e nenhuma fase posterior o alterou (git: `dominio/progressao.js` só tem 2 commits na história, ambos da própria Fase 06/legado).

## 5. Aplicação

### Implementado
* `ServicoProgressao` com `criarInicial` (idempotente, reparável), `obter` (auto-inicialização para jogador legado), `adicionarXp` e `aumentarAtributo` (ambos com `comTransacao` quando `banco` é fornecido — `servico-progressao.js:136,162`).
* Validação de existência do jogador em toda operação (`_garantirJogador`).
* Visão consolidada via `_montarVisao` (progressão + atributos + detalhe de nível).
* Integração com a criação do jogador via callback `aoCriar` (`main.js:826-838`), **dentro** da transação de `ServicoJogador.criar` (`servico-jogador.js:53-59`).

### Parcial
* `obter()` no caminho de auto-recuperação chama `criarInicial()` **sem transação própria** (justificado em comentário `:88-93`); se a 2ª escrita (atributos) falhar, a 1ª (progressão) permanece — recuperável na chamada seguinte, mas **não atômico**.
* Contrato de retorno **não uniforme**: `adicionarXp` devolve visão + `{subiuNivel, niveisGanhos}`; `aumentarAtributo` devolve só a visão; no curto-circuito de XP zero o objeto **não é congelado** (`:116-118`) enquanto os demais caminhos são (`Object.freeze`).
* Não há controle de concorrência explícito (aposta em `BEGIN IMMEDIATE` + aplicação single-player).

### Ausente
* Caso de uso de recompensa (missão/projeto) → XP; não há porta de entrada de XP além do botão de teste.
* Teste unitário do **serviço** com repositórios simulados (o projeto testa a aplicação por integração com banco real).

### Incompatível
Nada. Contrariamente à versão histórica (que tinha `inicializar/obter/adicionarXp/aumentarAtributo` com payloads `{progressao, progresso, atributos}` e flag `nivelou`, **sem transações e sem validar o jogador**), a versão em `dev` é mais estrita e é a vigente. Nenhum consumidor em `dev` espera o contrato antigo.

## 6. Banco de dados

### Implementado
* **v5** `criar-tabelas-progressao` (`migracoes.js:127-161`): `jogador_progressao` (`jogador_id` UNIQUE + CASCADE; `CHECK xp_total >= 0`, `CHECK nivel >= 1`, `CHECK pontos_disponiveis >= 0`) e `jogador_atributos` (`CHECK <atributo> >= 1`); ambas `STRICT`; `UNIQUE` já cria índice.
* **v9** `conciliar-progressao-legado` (`:310-415`): reconstrói `jogador_progressao` legado (sem `nivel`) e `jogador_atributo` (singular) preservando dados; `nivel = calcularNivel(xp_total)`; **no-op** em bancos corretos; bloqueia (erro explícito) no caso raro de plural+singular com dados.
* Migração é append-only, executada em transação com rollback (`:735-754`); nunca reexecuta (pula por versão).
* Testes cobrem: banco novo com a lista completa até v14 (`tests/unidade/migracoes.test.mjs:12-30`), inserção mínima nas duas tabelas (`:46-49`) e a réplica do banco legado com dados do usuário (`:264-356`).

### Parcial
* Não há **checksum** de migração aplicada: o mecanismo de "nunca reexecuta" é por **versão**, o que foi exatamente a causa do incidente do legado (P-019 registra a lacuna).
* Não há `CHECK` de **teto** nos atributos (o histórico tinha `BETWEEN 1 AND 100`).

### Ausente
* Tabela de histórico/ledger de XP (não prevista na fase).
* Índices adicionais além do `UNIQUE` (desnecessários hoje: consulta sempre por `jogador_id`).

### Incompatível
* A estrutura do **formato legado** (v5 com nome `criar-tabela-progressao`, sem `nivel`, `jogador_atributo` singular) é incompatível — e é tratada pela v9. Qualquer tentativa de "restaurar" a migração histórica sobre bancos já migrados seria um conflito real (a 005 já está registrada como aplicada).

## 7. IPC / Electron

### Implementado
Cadeia completa e consistente:
`renderer (principal.js) → preload (window.pulso.progressao) → ipcMain.handle → ServicoProgressao → Repositório → SQLite`.
* Canais: `progressao:obter`, `progressao:adicionar-xp`, `progressao:aumentar-atributo` (`canais.cjs:25-27`), replicados no preload (`preload.cjs:33-35`) — a sincronia é verificada por `tests/unidade/canais.test.mjs:21-33`.
* Handlers usam `traduzirResultadoOperacao` (`main.js:732-748`), traduzindo `ErroValidacao` → `{erro:'validacao', campo}`, `ErroConflito` → `{erro:'conflito'}` e erro interno → `{erro:'interno'}`.
* Parâmetros explícitos por jogador (`jogadorId`), diferente do histórico (que usava um único jogador implícito).
* Retornos: `{ok:true, progressao}`.

### Parcial
* Nenhum teste no nível de handler/canal de progressão (não existe teste de IPC para **nenhuma** fase; só o teste de consistência de nomes).
* O smoke test (`--teste-fumaca`) **não** valida o estado de progressão.

### Ausente
* Canal de recompensa/origem de XP (coerente com a ausência do caso de uso).

### Incompatível
* Os nomes históricos `progressao:adicionarXp` / `progressao:aumentarAtributo` (camelCase) eram **divergentes** do padrão vigente (kebab-case) e **não aparecem em nenhum lugar de `dev`** (grep vazio). Não há consumidor a preservar.

## 8. Interface

### Implementado
* Painel `#progressao-painel` (rótulo PERSONAGEM) dentro da visão de boot (`index.html:82-98`), com nível, `xpNoNivel / xpNecessario`, barra (`width %`), "Próximo nível", pontos disponíveis e lista de atributos com botão `+1` desabilitado sem pontos.
* Renderização dinâmica e segura (`replaceChildren`, `createElement`, sem `innerHTML`) em `principal.js:334-364`; recarga no boot (`:1648`) e após cada ação (`:375-376`, `:395-396`).
* Modal de LEVEL UP (`:403-426`) com foco no botão.
* Mensagens de erro em `#aviso-progressao` (`role="alert"`) e estado de falha de IPC.
* Botão de teste `SIMULAR XP +50` (`index.html:95`, desocultado em `principal.js:1719`).

### Parcial
* A **barra de XP não tem semântica ARIA de valor** (`role="progressbar"` sem `aria-valuenow/valuemin/valuemax`) — acessibilidade incompleta.
* Não há estado de carregamento/vazio explícito para o painel (o HTML traz valores default "NÍVEL 1 / 0 / 100 XP / 0").
* Lista de atributos remontada a cada render (sem atualização incremental) — decisão de implementação, não defeito.

### Ausente
* Tela/navegação própria "PERSONAGEM" (a versão histórica tinha `#visao-progressao` e aba de navegação). Hoje o painel vive no boot — funcionalidade equivalente, arquitetura diferente.
* Nenhuma exibição de **origem** de XP (não há dado).

### Incompatível
Nada. Os IDs históricos (`progressao-nivel-valor`, `progressao-xp-rotulo`, `progressao-xp-preenchimento`, `progressao-pontos-valor`, `progressao-atributos`, `acoes-progressao`) **não existem** em `dev`; os atuais são outros. Misturar as duas árvores de UI quebraria `mapearElementos()` (que lança `Elemento da interface ausente`).

## 9. Testes

### Cobertura existente
**TESTES UNITÁRIOS** — `tests/unidade/progressao.test.mjs` (13 testes): constantes iniciais, atributos iniciais, curva (1/2/3/10), curva rejeita nível 0/negativo/fração, nível nos limites (0/99/100/300/150/350/600), XP total inválido, `calcularProgresso` (nível/sobra/percentual 0,75), quantidade de XP (zero aceito/negativo rejeitado), `adicionarXp` parcial/zero/level-up/multi-level (−5 rejeitado), nomes de atributo (`mana` rejeitado), `aumentarAtributo` (consumo, excesso, zero, negativo).
**TESTES DE BANCO** — `tests/unidade/migracoes.test.mjs`: lista exata v1–v14 e `versaoAtual() === 14`; inserção mínima em `jogador_progressao`/`jogador_atributos`; conciliação do banco legado (XP 450, pontos 2 → `nivel === calcularNivel(450)`, atributos preservados, tabela singular removida, idempotência, no-op em banco correto).
**TESTES DE INTEGRAÇÃO** — `tests/integracao/progressao.test.mjs` (7 testes): jogador novo → nível 1/0 XP/0 pontos/atributos 1; XP positivo persistido; level-up no limite concede ponto; XP negativo e jogador inexistente (`ErroConflito`); distribuição com persistência e bloqueio de excesso; jogador órfão inicializado sem duplicar (COUNT = 1); persistência fechar→reabrir.
**Indiretos** — `tests/integracao/jogador.test.mjs:151,155` e `persistencia.test.mjs:41,45` afirmam a lista de migrações (005/009); `inicializacao.test.mjs` exercita o boot real (fumaça).

### Lacunas
* **Sem teste de IPC** dos três canais (nenhuma fase tem; risco transversal).
* **Sem e2e** da interface (P-006, adiado para a Fase 17): painel, botão `+1`, modal de LEVEL UP e estados de erro não são automatizados.
* **Sem teste do teto de atributo** (não existe teto) e **sem teste de XP de magnitude alta/overflow** (ex.: `Number.MAX_SAFE_INTEGER`, soma que estoure `Number.isSafeInteger`).
* **Sem teste do caminho de falha parcial** em `criarInicial` (auto-recuperação a partir de `obter`).
* **Sem teste do serviço isolado** (com repositórios fake) para validar as transações sem depender do SQLite.
* `docs/testes.md` **não tem seção da Fase 06** (tem 3.4 Fase 08, 3.5 Fase 09, 3.6/3.7 duplicado e 3.7/3.8/3.9 Fase 10.x) — a documentação de testes regrediu em relação ao trabalho entregue.

### Falhas encontradas
Nenhuma. Comando executado: `npm test` (dentro do workspace, sem alterar arquivos). Resultado: **345 testes, 345 pass, 0 fail, 0 skipped, `EXIT=0`**, incluindo os 20 testes de progressão, os de migração e o teste de topologia de schema v14. Não há testes obsoletos apontando para o contrato histórico (a suíte foi alinhada na reimplementação — `tests/integracao/jogador.test.mjs` e `persistencia.test.mjs` já esperam `criar-tabelas-progressao` + `conciliar-progressao-legado`).

## 10. Compatibilidade com Fase 07

**Status:** compatível; **nenhuma dependência funcional** de progressão.
**Dependências:** apenas `jogador` (FK) e infraestrutura compartilhada (`comTransacao`, `ErroValidacao/ErroConflito/ErroTransicao`, `canais.cjs`↔`preload.cjs`, lista de migrações). `src/core/dominio/projeto.js` e `servico-projeto.js` não importam nada de progressão (grep: zero ocorrências).
**Riscos:** BAIXO hoje. MÉDIO se a Fase 06 for estendida para conceder XP na conclusão de projeto: isso toca `ServicoProjeto.concluir()` e a atomicidade projeto+XP; `docs/projeto.md:63,85-86,154` e P-024 registram explicitamente que "o projeto não concede XP".
**Contratos:** nenhum contrato de progressão é consumido pela Fase 07. O contrato a preservar é o inverso — `RepositorioProjeto`/`projeto` (tabelas v6) não podem ser afetados.

## 11. Compatibilidade com Fase 08

**Status:** compatível; independente.
**Dependências:** compartilha `jogador` e `comTransacao`; **não** usa XP/nível/atributos. `docs/financas.md:207` exclui explicitamente "XP financeiro... sem automação"; `docs/financas.md:118` afirma que saldo não altera status/XP.
**Riscos:** BAIXO. Um "XP por disciplina financeira" seria escopo novo e tocaria `servico-financa.js`/`servico-pagamentos.js` (superfície transacional sensível da Fase 10.5).
**Contratos:** `ServicoFinanca` é consumido **por** outras fases (loja, pagamentos) — qualquer mudança nele reverbera em 09/10. A Fase 06 não participa dessa cadeia.

## 12. Compatibilidade com Fase 09

**Status:** compatível; independente.
**Dependências:** nenhuma com progressão. `docs/loja.md:14` ("**não** gera XP") e `src/core/dominio/loja.js:5` ("NAO altera saldo/orcamento/XP") documentam o desacoplamento; a compra é atômica via Fase 08.
**Riscos:** BAIXO. Duplicar regra de XP na loja seria violação de camada e criaria segunda fonte de verdade de XP.
**Contratos:** `Loja`/`Desejo` (tabela v8) e `servico-loja.js` — intocados.

## 13. Compatibilidade com Fase 10

**Status:** compatível; independente (10.1–10.6).
**Dependências:** nenhuma de progressão. Compartilha `comTransacao`, `jogador`, mecanismo de migrações e o teste de sincronia de canais. `docs/pagamentos.md`/`contas-despesas.md` não citam XP.
**Riscos:**
* BAIXO — uso normal.
* **MÉDIO/ALTO** se a Fase 06 exigir **nova migração**: a lista é verificada de forma exata em **3 lugares** (`tests/unidade/migracoes.test.mjs:14-30`, `tests/integracao/jogador.test.mjs:151-155`, `tests/integracao/persistencia.test.mjs:41-45`) e a v14 é o topo. Uma migração nova precisa ser **v15 append-only** e todos esses pontos atualizados — risco de regressão de testes se renumerar/renomear.
* MÉDIO — a v9 (`conciliar-progressao-legado`) é a única migração no estilo "reconstrói tabela por detecção"; qualquer mexida em `jogador_progressao` sem preservá-la quebraria bancos legados e o teste de conciliação.
**Contratos:** nome/versão das 14 migrações, `MIGRACOES` congelado, `versaoAtual()`; `servico-pagamentos.js` (única coisa do módulo 10 que movimenta dinheiro) não pode ser tocado por progressão.

## 14. Comparação com implementação histórica

> Comparação semântica entre `7473e06` (primeira implementação, `backup/fase-06-original-7473e06`, linhagem abandonada) e o estado de `dev` (`a8591a2`).
>
> Tratamento: PRESERVADA · PRESERVADA COM ALTERAÇÕES · ABSORVIDA · SUBSTITUÍDA · PARCIAL · AUSENTE · OBSOLETA

| Funcionalidade histórica | Estado atual | Tratamento |
|---|---|---|
| Constantes iniciais (nível 1, XP 0, pontos 0) | idênticas em semântica | PRESERVADA |
| Curva `100 × nível` (`xpParaProximoNivel`) | `xpNecessarioParaProximoNivel` | PRESERVADA COM ALTERAÇÕES (renomeada; mensagens/`campo` de erro melhores) |
| `calcularNivel` | equivalente, com `validarXpTotal` | PRESERVADA COM ALTERAÇÕES |
| `calcularProgresso` | equivalente; `progresso` virou **fração 0–1** (era percentual 0–100) | PRESERVADA COM ALTERAÇÕES |
| `adicionarXp`/level-up/pontos por nível | existe como `adicionarXp` (domínio) + serviço transacional; flag `nivelou` → `subiuNivel` | PRESERVADA COM ALTERAÇÕES |
| `calcularLevelUp` | absorvida dentro de `adicionarXp` (helper separado removido) | ABSORVIDA |
| `validarXp` (positivo obrigatório) | `validarQuantidadeXp` (zero permitido = no-op) | SUBSTITUÍDA |
| `criarAtributosIniciais` | `atributosIniciais` | PRESERVADA COM ALTERAÇÕES |
| `validarNomeAtributo` | existe (com lista de disponíveis na mensagem) | PRESERVADA COM ALTERAÇÕES |
| `validarQuantidadePontos` | validação embutida em `aumentarAtributo` | ABSORVIDA |
| `validarValorAtributo` + `ATRIBUTO_MINIMO/MAXIMO` (1–100, domínio **e** banco) | mínimo 1 mantido (domínio + `CHECK`); **teto 100 removido** | PARCIAL (teto AUSENTE) |
| `ATRIBUTOS` + `ATRIBUTOS_ROTULOS` (Title Case) | `ATRIBUTOS_DISPONIVEIS` + rótulos em CAIXA ALTA | PRESERVADA COM ALTERAÇÕES |
| `ServicoProgressao.inicializar` | `criarInicial` (idempotente, sem transação própria) | PRESERVADA COM ALTERAÇÕES |
| `ServicoProgressao.obter` devolvendo `{progressao, progresso, atributos}` | devolve **visão plana** (nível/XP/pontos/atributos/progresso juntos) | SUBSTITUÍDA |
| `ServicoProgressao.adicionarXp`/`aumentarAtributo` **sem transação** | ambos com `comTransacao` | PRESERVADA COM ALTERAÇÕES (melhor) |
| Validar existência do jogador na aplicação | adicionada (`_garantirJogador`) | PRESERVADA COM ALTERAÇÕES (melhor) |
| `RepositorioProgressao` único (progressão + atributos, `UPDATE` dinâmico por atributo) | **dois** repositórios (`progressao.js`, `atributos.js`) com `UPDATE` único de 7 colunas | SUBSTITUÍDA |
| Migração v5 `criar-tabela-progressao`, sem coluna `nivel`, `jogador_atributo` singular, `DEFAULT 1/0`, `BETWEEN 1 AND 100` | v5 `criar-tabelas-progressao`, com `nivel`, `jogador_atributos` plural, sem DEFAULT, sem teto | SUBSTITUÍDA (bancos antigos reconciliados pela v9) |
| Canais `progressao:obter`, `progressao:adicionarXp`, `progressao:aumentarAtributo` (camelCase, jogador implícito) | `progressao:obter`, `progressao:adicionar-xp`, `progressao:aumentar-atributo` (kebab-case, `jogadorId` explícito) | SUBSTITUÍDA |
| Preload `progressao.{obter(), adicionarXp(), aumentarAtributo()}` sem `jogadorId` | com `jogadorId`/`quantidade` | SUBSTITUÍDA |
| Tela dedicada `#visao-progressao` + aba de navegação PERSONAGEM (`progressao-nivel-valor`, `progressao-xp-rotulo`, `progressao-xp-preenchimento` via `scaleX`, `progressao-pontos-valor`, `progressao-atributos`, `acoes-progressao`) | painel `#progressao-painel` no boot (`progressao-nivel`, `progressao-xp-texto`, `progressao-preenchimento` via `width`, `progressao-pontos`, `atributos-lista`) | SUBSTITUÍDA (mesma função, arquitetura de UI diferente) |
| Modal de level-up | `exibirLevelUp` + `.levelup-*` | PRESERVADA COM ALTERAÇÕES |
| Botão de teste de XP | `SIMULAR XP +50` | PRESERVADA |
| Testes de progressão históricos | 13 unidade + 7 integração equivalentes | PRESERVADA COM ALTERAÇÕES |
| XP por conclusão de missão | nunca existiu em nenhuma linhagem | OBSOLETA/AUSENTE (P-022) |
| Reset/respec de atributos | nunca existiu | OBSOLETA (P-023) |

## 15. Contratos que devem ser preservados

| Contrato | Local | Consumidores | Risco |
|---|---|---|---|
| `NIVEL_INICIAL`, `XP_INICIAL`, `PONTOS_INICIAIS`, `VALOR_INICIAL_ATRIBUTO`, `PONTOS_POR_NIVEL`, `ATRIBUTOS_DISPONIVEIS`, `ATRIBUTOS_ROTULOS` | `dominio/progressao.js:13-39` | testes unitários, serviço | BAIXO |
| `xpNecessarioParaProximoNivel`, `calcularNivel`, `calcularProgresso`, `adicionarXp`, `aumentarAtributo`, `atributosIniciais`, `validarNomeAtributo`, `validarXpTotal`, `validarQuantidadeXp`, `validarPontosDisponiveis` | `dominio/progressao.js` | serviço, testes, **`migracoes.js:19` (`calcularNivel`)** | MÉDIO — renomear quebra a migração 009 e a suíte |
| `ServicoProgressao.{criarInicial, obter, adicionarXp, aumentarAtributo}` | `servico-progressao.js` | `main.js:396-419, 826-838`, testes de integração | MÉDIO |
| Formato da visão retornada (nível, xpTotal, pontosDisponiveis, atributos, xpNoNivel, xpNecessario, progresso, criadoEm, atualizadoEm, +`subiuNivel`/`niveisGanhos` em `adicionarXp`) | `servico-progressao.js:41-63,130-134` | renderer (`principal.js:334-378`) | ALTO — é o contrato real da UI |
| `RepositorioProgressao.{criar,buscarPorJogador,atualizar,existe}` / `RepositorioAtributos.{criar,buscarPorJogador,atualizar,existe}` | `repositorios/progressao.js:52-71`; `atributos.js:55-92` | serviço, `main.js:799-800` | MÉDIO |
| Canais `progressao:obter`, `progressao:adicionar-xp`, `progressao:aumentar-atributo` | `canais.cjs:25-27` + `preload.cjs:33-35` | IPC ↔ preload (teste de sincronia) | ALTO — renomear exige atualizar os dois + teste |
| API `window.pulso.progressao.{obter(jogadorId), adicionarXp(jogadorId,quantidade), aumentarAtributo(jogadorId,atributo,quantidade)}` | `preload.cjs:213-217` | `principal.js:324,370,390` | ALTO |
| Payloads IPC `{jogadorId}`, `{jogadorId,quantidade}`, `{jogadorId,atributo,quantidade}` e retorno `{ok, progressao}` / `{ok:false, erro, campo, mensagem}` | `main.js:396-419,732-748` | renderer | ALTO |
| Estrutura de banco `jogador_progressao(jogador_id UNIQUE, xp_total, nivel, pontos_disponiveis, criado_em, atualizado_em)` e `jogador_atributos(jogador_id UNIQUE, 7 atributos, criado_em, atualizado_em)` | `migracoes.js:127-161` | repositórios, migração 009, testes | ALTO |
| Nome/versão das 14 migrações + `MIGRACOES` congelado + `versaoAtual()` | `migracoes.js:684-699,723-766` | 3 arquivos de teste + `inicializar.js` | ALTO |
| IDs do DOM `#progressao-*`, `#atributos-lista`, `#aviso-progressao`, `#botao-teste-xp` | `index.html:82-98` | `principal.js:121-129` (`mapearElementos` lança se faltar) | MÉDIO |
| `ErroValidacao`/`ErroConflito` + `traduzirResultadoOperacao` | `erros.js`; `main.js:732-748` | todas as fases | ALTO (transversal) |
| `comTransacao` | `database/transacao.js` | serviço de progressão e todas as fases | ALTO (transversal) |

## 16. Problemas encontrados

### Críticos
Nenhum. Não há indisponibilidade funcional, inconsistência de schema, teste quebrado ou caminho de dados corrompido. Suíte 100% verde e migração de legado coberta.

### Altos
1. **XP não tem origem auditável.** `ORIGENS_XP` é constante morta (`dominio/progressao.js:42`) e não existe ledger. Não é possível distinguir XP de missão/projeto/conquista/ajuste. Aceitável na fase (P-022), mas é o principal veto a um "Fase 06 concluída" em sentido pleno.
2. **Teto de atributo removido sem decisão documentada.** O histórico impunha `1..100` (domínio + `CHECK`); `dev` não impõe teto em nenhuma camada. `docs/progressao.md` declara apenas "Mínimo absoluto: 1". É uma **mudança semântica não registrada** (nem em ADR, nem em `pendencias.md`), com risco de crescimento ilimitado de atributos e de dados legados acima de 100 (que a v9 preserva sem reclamar).

### Médios
3. **Padrão de falha do caminho de auto-recuperação.** `obter()` → `criarInicial()` fora de transação (`servico-progressao.js:88-104`): se a criação dos atributos falhar depois da criação da progressão, fica um estado parcial (recuperável, mas não atômico).
4. **Contrato de retorno não uniforme** entre `adicionarXp` (com `subiuNivel`/`niveisGanhos`, e objeto **não congelado** no caso XP=0) e `aumentarAtributo`/`obter` (sem esses campos, congelados). A UI depende implicitamente dessa diferença.
5. **Documentação divergente:** `docs/banco-de-dados.md:409` afirma que as migrações vão "até **007**" enquanto a mesma página (`:330`) afirma v14; `docs/progressao.md` não menciona a **migração 009** (conciliação do legado) nem a mudança de formato da v5; `docs/testes.md` **não tem seção da Fase 06** e tem numeração de seções duplicada (3.6/3.7).
6. **Sem validação de magnitude/overflow de XP.** `adicionarXp` soma sem `Number.isSafeInteger`; não há teste para totais muito altos (nem para o custo O(nível) de `calcularNivel`).

### Baixos
7. Barra de XP sem `aria-valuenow/valuemin/valuemax` (`index.html:88`).
8. `ORIGENS_XP` e `PONTOS_POR_NIVEL` sem teste de valor semântico além de `PONTOS_POR_NIVEL === 1`; `ORIGENS_XP` sem nenhum teste.
9. Sem teste de IPC dos 3 canais (lacuna transversal a todas as fases).
10. Inversão leve de camada: `database/migracoes.js:19` importa o **domínio** (`calcularNivel`) — deliberado e documentado, mas é o único ponto do projeto onde o banco depende do domínio.
11. `dist/PULSO-0.1.0/{Linux,Windows}` contém cópia empacotada do código com a progressão atual (arquivo `dominio/progressao.js` idêntico ao de `dev`) — artefato de build versionado, risco de confusão em auditorias futuras.
12. UI: lista de atributos é remontada integralmente a cada ação (custo baixo, mas perde foco/scroll em cenários maiores).

## 17. Riscos de implementação

Classificação dos riscos de **reconstruir/completar** a Fase 06 sobre `dev`:

| Risco | Classificação |
|---|---|
| Restaurar a implementação histórica `7473e06` (canais camelCase, `jogador_atributo` singular, v5 sem `nivel`) | **ALTO** — quebra o teste de sincronia de canais, conflita com a v5 já aplicada e com dados migrados pela v9 |
| Editar a migração 005 (já aplicada) em vez de criar v15 | **ALTO** — viola a regra "migração aplicada nunca é editada"; bancos existentes ficariam inconsistentes |
| Renumerar/renomear migrações ou inserir no meio da lista | **ALTO** — quebra `validarLista` e os 3 testes que afirmam a lista exata |
| Alterar o formato da visão de progressão (`ServicoProgressao._montarVisao`) | **ALTO** — o renderer lê `nivel/xpNoNivel/xpNecessario/progresso/pontosDisponiveis/atributos/subiuNivel` |
| Renomear um canal IPC sem atualizar `canais.cjs` **e** `preload.cjs` | **ALTO** — falha o teste de consistência |
| Alterar a estrutura de `jogador`/`jogador_progressao` sem nova migração | **ALTO** — impacto em FKs, `CHECK`s e no legado |
| Duplicar a regra de XP em outra fase (07/14) em vez de reutilizar o domínio | **MÉDIO** — duas fontes de verdade, divergência de curva |
| Introduzir teto de atributo (ex.: 100) via nova migração com `CHECK` | **MÉDIO** — exige v15 + atualização dos 3 testes de lista + tratamento de dados existentes acima do teto (pode falhar/bloquear) |
| Migração destrutiva do `jogador_progressao` legado (recriar sem preservar dados) | **MÉDIO/ALTO** — perda de XP/pontos; a v9 é a referência de comportamento seguro |
| Conectar XP à conclusão de missão/projeto dentro da Fase 06 | **MÉDIO** — muda fluxos da Fase 05/07 e a atomicidade; P-022/P-024 dizem que pertence a fase futura |
| Regressão de testes por qualquer mudança em `dominio/progressao.js` | **MÉDIO** — 20 testes + migração 009 + `calcularNivel` consumido pelo banco |
| Quebrar Fase 08/09/10 | **BAIXO** — não há dependência funcional; só infraestrutura compartilhada |
| Quebrar Fase 07 | **BAIXO** — só FK de jogador; MÉDIO se houver recompensa de XP |
| Instalar dependências / mudar config para "completar" a fase | **BAIXO** — nenhuma necessidade; stack vigente é suficiente |

## 18. Escopo recomendado

Somente o que falta para **considerar a Fase 06 concluída sobre `dev`** (sem reconstruir nada que já funciona):

1. **Decidir e registrar o teto de atributo.** Ou (a) manter sem teto e documentar a decisão como ADR/nota em `docs/progressao.md` + `pendencias.md`, ou (b) reintroduzir teto via **migração v15** (append-only) + validação no domínio + atualização dos 3 testes que afirmam a lista de migrações + tratamento do legado. *(Decisão de produto; não implementar antes de decidir.)*
2. **Resolver `ORIGENS_XP`.** Ou é usada por um caso de uso (nem que seja um campo opcional de origem em `adicionarXp`, futuro), ou deve ser removida/justificada em comentário para não ficar como código morto.
3. **Uniformizar o contrato de retorno do serviço.** `obter`, `adicionarXp` e `aumentarAtributo` devem devolver a mesma forma (congelada) — decidir se `subiuNivel/niveisGanhos` existem em todas ou apenas nas mutações, e documentar.
4. **Atomicidade do caminho de auto-recuperação.** Tornar `criarInicial()` transacional quando chamado fora de uma transação de jogador (ou registrar formalmente como limitação aceita).
5. **Alinhar documentação:** `docs/banco-de-dados.md:409` (migrações "até 007" → v14); `docs/progressao.md` (migração 009, formato da v5, ausência de teto, `progresso` como fração 0–1); `docs/testes.md` (seção da Fase 06 e correção das numerações duplicadas 3.6/3.7).
6. **Fechar lacunas de teste** dos contratos que já existem: IPC dos 3 canais (handler-level), teto de atributo (se existir), XP de magnitude alta, e o caminho de falha parcial de `criarInicial`.
7. **Acessibilidade do painel:** `aria-valuenow/valuemin/valuemax` na barra de XP.

Nada além disso é necessário: domínio, aplicação, banco, IPC, preload, interface, migração de legado e testes do escopo declarado já estão entregues e verdes.

## 19. Fora do escopo

* **XP por conclusão de missão** — P-022 (integração futura; `docs/missao.md:169`).
* **XP/dinheiro por conclusão de projeto** — P-024 (`docs/projeto.md:154`).
* **Reset/respec de atributos** — P-023.
* **Habilidades/árvore de habilidades** — Fase 11.
* **Conquistas/marcos** — Fase 14 (a origem `CONQUISTA` só existe como rótulo).
* **Dashboard consolidado** — Fase 15.
* **e2e de interface** — P-006, Fase 17.
* **Criptografia do banco, backup automático, checksum de migração** — P-017/P-018/P-019.
* **Empacotamento/portabilidade** — Fase 18.
* **Reintroduzir a tela dedicada `#visao-progressao`** (arquitetura histórica) — substituída pelo painel no boot; não é requisito.
* **Renomear canais para camelCase** (histórico) — contrário ao padrão vigente.
* **Qualquer coisa já funcionando** em `dev` (domínio, serviço transacional, repositórios, migração 005 + 009, IPC, preload, painel, modal, testes).

## 20. Critérios de conclusão da Fase 06

- [ ] Decisão sobre teto de atributo registrada (com ou sem teto) em `docs/progressao.md` e/ou `pendencias.md`.
- [ ] Se houver teto: migração **v15** append-only criada, `CHECK` aplicado, domínio validando, dados legados acima do teto tratados.
- [ ] Lista de migrações atualizada nos 3 pontos de teste (`tests/unidade/migracoes.test.mjs`, `tests/integracao/jogador.test.mjs`, `tests/integracao/persistencia.test.mjs`) e `versaoAtual()` corrigida.
- [ ] `ORIGENS_XP` usada por um caso de uso **ou** removida com justificativa.
- [ ] Formato do retorno de `ServicoProgressao.{obter, adicionarXp, aumentarAtributo}` uniforme (mesma forma, congelado) e refletido no renderer.
- [ ] `criarInicial()` atômico no caminho de `obter()` **ou** limitação documentada explicitamente.
- [ ] `docs/progressao.md` atualizado: migração 009, formato da v5, `progresso` como fração 0–1, ausência/presença de teto, limitações.
- [ ] `docs/banco-de-dados.md:409` corrigido (migrações até v14) e coerente com `:330`.
- [ ] `docs/testes.md` com seção da Fase 06 (unidade + integração) e numeração de seções corrigida.
- [ ] Teste de IPC dos canais `progressao:obter` / `progressao:adicionar-xp` / `progressao:aumentar-atributo` existente (ou lacuna formalmente registrada em `pendencias.md`).
- [ ] Testes cobrindo XP de magnitude alta e o caminho de falha parcial de `criarInicial`.
- [ ] `aria-valuenow/valuemin/valuemax` na barra de XP do painel.
- [ ] `npm test` verde (hoje: 345/345) com os novos testes.
- [ ] `docs/roadmap.md` mantém Fase 06 como concluída **somente** após os itens acima.

## 21. Conclusão

A Fase 06 está:

- [ ] Completa
- [ ] Parcialmente completa
- [ ] Incompleta
- [x] **Funcionalmente presente, mas precisa de adequação arquitetural**
- [ ] Não implementada

**Justificativa com base nas evidências:**

1. **Está presente, e não parcialmente:** o corte vertical inteiro existe em `dev` e funciona — domínio puro (`dominio/progressao.js`, 186 linhas), serviço com transações (`servico-progressao.js`), dois repositórios, migração v5 + conciliação v9, 3 canais IPC, API de preload, painel PERSONAGEM com barra/pontos/7 atributos/+1, modal de LEVEL UP e botão de teste de XP. `npm test` → **345/345 verdes**, com 20 testes próprios da progressão e cobertura explícita da conciliação do banco legado.
2. **O conflito histórico foi resolvido de forma correta:** a linhagem original (`7473e06`) não é ancestral de `dev`; o que existe veio de `7de0ddb`…`a426c3e` (reimplementação) mais `76990e9`/PR #4 (migração 009 de conciliação). Bancos criados pela primeira implementação são reconciliados preservando XP, pontos e atributos, com `nivel` derivado por `calcularNivel`, de forma idempotente.
3. **Não é "completa" em sentido estrito** por três motivos verificáveis: (a) uma **mudança semântica não documentada** (remoção do teto de atributo que existia no histórico, sem decisão registrada); (b) **código morto de intenção** (`ORIGENS_XP`) e contrato de retorno assimétrico/parcialmente congelado; (c) **drift de documentação** (`banco-de-dados.md` diz "até 007" na mesma página que diz v14; `progressao.md` ignora a migração 009; `testes.md` não tem seção da Fase 06).
4. **Não é "incompleta"** porque os itens ausentes de XP por missão/projeto (P-022/P-024) e respec (P-023) estavam **explicitamente fora do escopo declarado da fase** em `docs/progressao.md` e `roadmap.md` — são integrações futuras, não lacunas da Fase 06.
5. **As fases 07–10 são compatíveis:** nenhuma depende de progressão/XP; todas apenas compartilham `jogador`, `comTransacao`, o tradutor de erros e a lista de migrações. O único risco relevante é operacional: qualquer nova migração precisa ser v15 append-only com atualização dos 3 testes que fixam a lista — e qualquer tentativa de "restaurar" a implementação histórica produziria regressão alta (canais, UI, schema e testes).

**Dúvidas registradas (não assumidas):** (i) se o teto de atributo deve voltar (e com qual valor/política de dados legados) — decisão de produto; (ii) se `ORIGENS_XP` deve ser promovida a contrato ou eliminada; (iii) se `subiuNivel`/`niveisGanhos` devem existir em todas as respostas ou só nas mutações; (iv) se o caminho de auto-recuperação de `obter()` deve ser atômico ou permanecer "idempotente e reparável por design".

---

*Relatório produzido por auditoria somente-leitura sobre `dev` (`a8591a2`). Nenhum arquivo de código, teste, configuração ou banco foi alterado. Este documento é a única adição ao repositório.*

