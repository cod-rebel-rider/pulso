# Pendências — PULSO

Registro de necessidades identificadas durante as fases que **serão resolvidas em fases futuras** (regra: documentar, registrar, não antecipar implementação).

## Pendências abertas

| ID | Pendência | Fase destino | Observação |
| --- | --- | --- | --- |
| P-003 | Adicionar ESLint/Prettier (qualidade de código) | 02 — Banco de Dados ou próxima adequada | manter fundação sem dependências além do Electron |
| P-004 | Definir driver SQLite (`node:sqlite` vs `better-sqlite3`) | 02 — Banco de Dados | Electron 37.10.3 embute Node 22.21.1 → `node:sqlite` agora é viável |
| P-005 | Instalar CLI `sqlite3` (opcional) | 02 — Banco de Dados | `sudo apt install sqlite3` — apenas para inspeção manual |
| P-006 | Definir ferramenta de e2e (ex.: Playwright) | 17 — Testes e Estabilização | para automatizar a janela além do teste de fumaça |
| P-007 | Definir ferramenta de empacotamento (electron-builder/forge) | 18 — Portabilidade | pacotes Linux, Windows e pendrive, separados |
| P-008 | Avaliar atualização do Node do sistema para 22 LTS | 02 — Banco de Dados | sistema usa Node 20.20.2; o Electron 37 embute Node 22.21.1 |
| P-009 | Definir licença do projeto | quando o usuário decidir | `package.json` usa `UNLICENSED` até lá |
| P-010 | Publicar remote (origin/dev existe) e fluxo de Pull Requests | quando o usuário desejar | hoje: merges locais `--no-ff` documentados |
| P-011 | Selecionar fontes locais (mono + sans) | primeira fase de interface | hoje: stack de fontes monoespaçadas do sistema |
| P-012 | Logging com saída em arquivo (rotacionado) | fase futura a definir | Fase 01 usa apenas console com formato estável |
| P-013 | Ícone do aplicativo (janela/instalador) | fase de interface/polimento | hoje: favicon em data-URI e sem ícone de janela |
| P-014 | Janela estilo HUD sem moldura + barra de título própria | 16 — Polimento | decisão de UX; mantida moldura padrão na fundação |
| P-015 | Executar teste de fumaça em CI headless | 17 — Testes e Estabilização | exige xvfb (ausente no ambiente atual) |
| P-016 | Retestar upgrades do Electron (37 → 39/41+) | contínua | 39.x e 41.x sofrem SIGSEGV neste sistema (ADR-008) |

## Pendências resolvidas

| ID | Pendência | Resolvida em |
| --- | --- | --- |
| P-001 | Instalar Electron e criar janela base | Fase 01 — Electron 37.10.3 (ver ADR-008) |
| P-002 | Definir abordagem de interface (vanilla vs framework) | Fase 01 — vanilla JS (ver ADR-006) |
