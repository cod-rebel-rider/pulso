# Pendências — PULSO

Registro de necessidades identificadas durante as fases que **serão resolvidas em fases futuras** (regra: documentar, registrar, não antecipar implementação).

| ID | Pendência | Fase destino | Observação |
| --- | --- | --- | --- |
| P-001 | Instalar Electron e criar janela base | 01 — Fundação | incluindo decisão de versão do Electron |
| P-002 | Definir abordagem de interface (vanilla vs framework) | 01 — Fundação | decidir com a primeira tela real; não antecipar |
| P-003 | Adicionar ESLint/Prettier (qualidade de código) | 01 — Fundação | manter Fase 00 sem dependências |
| P-004 | Definir driver SQLite (`node:sqlite` vs `better-sqlite3`) | 02 — Banco de Dados | depende do Node embutido no Electron da Fase 01 |
| P-005 | Instalar CLI `sqlite3` (opcional) | 02 — Banco de Dados | `sudo apt install sqlite3` — apenas para inspeção manual |
| P-006 | Definir ferramenta de e2e (ex.: Playwright) | 17 — Testes e Estabilização | para automatizar a janela Electron |
| P-007 | Definir ferramenta de empacotamento (electron-builder/forge) | 18 — Portabilidade | pacotes Linux, Windows e pendrive, separados |
| P-008 | Avaliar atualização do Node do sistema para 22 LTS | 02 — Banco de Dados | relevante apenas se `node:sqlite` for o driver escolhido |
| P-009 | Definir licença do projeto | quando o usuário decidir | `package.json` usa `UNLICENSED` até lá |
| P-010 | Criar remote (GitHub) e fluxo de Pull Requests | quando o usuário desejar | hoje: merges locais `--no-ff` documentados |
| P-011 | Selecionar fontes locais (mono + sans) | primeira fase de interface | sempre offline, nunca CDN |
