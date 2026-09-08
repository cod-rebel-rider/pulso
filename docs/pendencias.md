# Pendências — PULSO

Registro de necessidades identificadas durante as fases que **serão resolvidas em fases futuras** (regra: documentar, registrar, não antecipar implementação).

## Pendências abertas

| ID | Pendência | Fase destino | Observação |
| --- | --- | --- | --- |
| P-003 | Adicionar ESLint/Prettier (qualidade de código) | fase adequada | manter camadas sem dependências além do Electron |
| P-005 | Instalar CLI `sqlite3` (opcional) | quando útil | `sudo apt install sqlite3` — inspeção manual (banco atual: SQLite 3.50.4) |
| P-006 | Definir ferramenta de e2e (ex.: Playwright) | 17 — Testes e Estabilização | para automatizar a janela além do teste de fumaça |
| P-007 | Definir ferramenta de empacotamento (electron-builder/forge) | 18 — Portabilidade | pacotes Linux, Windows e pendrive, separados |
| P-008 | Avaliar atualização do Node do sistema para 22 LTS | 02 — Banco de Dados | sistema usa Node 20.20.2; o Electron 37 embute Node 22.21.1 |
| P-009 | Definir licença do projeto | quando o usuário decidir | `package.json` usa `UNLICENSED` até lá |
| P-010 | Publicar remote (origin/dev existe) e fluxo de Pull Requests | quando o usuário desejar | hoje: merges locais `--no-ff` documentados |
| P-011 | Selecionar fontes locais (mono + sans) | primeira fase de interface | hoje: stack de fontes monoespaçadas do sistema |
| P-020 | Registrar atalhos de teclado (ex.: Ctrl+E para edição) | fase de polimento | conveniência futura |
| P-012 | Logging com saída em arquivo (rotacionado) | fase futura a definir | Fase 01 usa apenas console com formato estável |
| P-013 | Ícone do aplicativo (janela/instalador) | fase de interface/polimento | hoje: favicon em data-URI e sem ícone de janela |
| P-014 | Janela estilo HUD sem moldura + barra de título própria | 16 — Polimento | decisão de UX; mantida moldura padrão na fundação |
| P-015 | Executar teste de fumaça em CI headless | 17 — Testes e Estabilização | exige xvfb (ausente no ambiente atual) |
| P-016 | Retestar upgrades do Electron (37 → 39/41+) | contínua | 39.x e 41.x sofrem SIGSEGV neste sistema (ADR-008) |
| P-017 | Backup automático do banco (agendado + verificação de integridade) | fase futura a definir | hoje: backup manual documentado (`banco-de-dados.md`, seção 9) |
| P-018 | Criptografia do banco (ex.: SQLCipher) | avaliar quando houver ameaça real | decisão exigirá novo ADR (`banco-de-dados.md`, seção 10) |
| P-019 | Migrações de reversão (down) e checksum de migrações aplicadas | fase futura | hoje: reversão = restaurar backup |
| P-021 | Adicionar CHECK constraints no banco (ex.: `energia BETWEEN 0 AND 100`) | fase de polimento | hoje: a aplicação garante os limites antes de persistir |
| P-022 | Recompensas de missões (XP, dinheiro, itens, efeitos sobre status) | Fase 06 — Progressão | missões atualmente não concedem recompensas |

## Pendências resolvidas

| ID | Pendência | Resolvida em |
| --- | --- | --- |
| P-001 | Instalar Electron e criar janela base | Fase 01 — Electron 37.10.3 (ver ADR-008) |
| P-002 | Definir abordagem de interface (vanilla vs framework) | Fase 01 — vanilla JS (ver ADR-006) |
| P-004 | Definir driver SQLite (`node:sqlite` vs `better-sqlite3`) | Fase 02 — `node:sqlite` nativo, SQLite 3.50.4 (ver ADR-009) |
