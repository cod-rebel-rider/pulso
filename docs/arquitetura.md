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
| Domínio | `src/core/dominio` | **Iniciado (Fase 03)**: `jogador.js` (regras de identidade, validações puras) |
| Aplicação | `src/core/aplicacao` | **Iniciado (Fase 03)**: `servico-jogador.js` (orquestração single-player) |
| Persistência | `src/core/database` | **Implementada (Fase 02)**: conexão SQLite, migrações, repositórios |
| Módulos | `src/modules` | Funcionalidades independentes com contrato público documentado |

## 3. Comunicação

- **Interface ↔ núcleo:** via IPC do Electron (a partir da Fase 01), com canais nomeados por módulo e mensagens estruturadas (ex.: canal `missao:listar`). O renderer recebe apenas dados já processados.
- **Módulo ↔ módulo:** preferencialmente indireto, por meio da camada de aplicação. Acoplamento direto entre módulos deve ser evitado; quando necessário, deve estar explícito no contrato do módulo.
- **Núcleo ↔ banco:** exclusivamente pela camada de persistência (`src/core/database/`), por meio de repositórios — **implementado na Fase 02** (conexão, migrações) e estendido na Fase 03 (`RepositorioJogador`);
- **Domínio validando com regras próprias:** desde a Fase 03, a identidade do jogador é validada em `src/core/dominio/jogador.js` (puro, testável) antes de persistir;

## 4. Módulos previstos (apenas planejados — nenhum implementado)

`Missões · Projetos · Jogador · Status · Progressão · Finanças · Loja · Serviços · Habilidades · Música · Mapa · Conquistas`

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
