# PULSO

> Sistema pessoal de gestão da vida que transforma atividades, projetos, objetivos, finanças, aprendizado e música em uma experiência de progressão inspirada em RPG e Cyberpunk/Netrunner.

**Status:** FASE 02 — BANCO DE DADOS (concluída). A aplicação abre, funciona, fecha e reabre — e agora possui **memória local persistente** (SQLite): criada automaticamente, versionada por migrações, isolada da interface.

## Princípios

| Princípio | Significado |
| --- | --- |
| Local-first | Funciona localmente, sem depender de serviços online |
| Privacidade | Dados pessoais permanecem na sua máquina por padrão |
| Offline-first | Funcionalidades essenciais funcionam sem internet |
| Modularidade | Módulos independentes, com interfaces claras |
| Extensibilidade | Novas funcionalidades sem reescrever o núcleo |
| Dados persistentes | Banco de dados local (SQLite — a partir da Fase 02) |

## Stack

- **Electron 37.x** — aplicação desktop (fixado por compatibilidade; ver `docs/arquitetura.md`, ADR-008)
- **HTML + CSS + JavaScript (vanilla, ESM)** — interface e lógica
- **SQLite 3.50.4 (via `node:sqlite` nativo)** — persistência local, sem dependências externas (ADR-009)
- **Node.js ≥ 20** e **npm ≥ 10** — ferramentas de desenvolvimento
- Idioma do projeto: **Português do Brasil (pt-BR)**

## Como começar

```bash
npm install                 # instala dependências (inclui o Electron)
npm start                   # inicia a aplicação desktop
npm test                    # testes unitários + teste de fumaça do Electron
npm run verificar-ambiente  # verifica o ambiente de desenvolvimento
```

## Estrutura

```text
pulso/
├── src/
│   ├── main/       → processo principal Electron (janela, IPC, configuração, registro)
│   ├── renderer/   → interface (tela de fundação Cyberpunk/Netrunner)
│   ├── core/       → núcleo: database (SQLite, migrações, repositórios), aplicação e domínio (fases futuras)
│   └── modules/    → módulos futuros (missões, finanças, música…)
├── database/       → esquemas e migrações (Fase 02)
├── assets/         → recursos visuais e fontes locais
├── config/         → configurações por ambiente (dev/teste/produção)
├── scripts/        → ferramentas de desenvolvimento
├── tests/          → testes (unidade e integração/teste de fumaça)
└── docs/           → documentação do projeto
```

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Arquitetura, camadas e decisões técnicas (ADR) |
| [`docs/regras-do-projeto.md`](docs/regras-do-projeto.md) | Princípios, idioma e convenções |
| [`docs/roadmap.md`](docs/roadmap.md) | Fases 00–18 e status |
| [`docs/banco-de-dados.md`](docs/banco-de-dados.md) | Estratégia de persistência (SQLite) |
| [`docs/interface.md`](docs/interface.md) | Princípios da interface |
| [`docs/identidade-visual.md`](docs/identidade-visual.md) | Paleta e linguagem visual |
| [`docs/testes.md`](docs/testes.md) | Estratégia de testes |
| [`docs/desenvolvimento.md`](docs/desenvolvimento.md) | Guia de desenvolvimento e contribuição |
| [`docs/pendencias.md`](docs/pendencias.md) | Pendências registradas para fases futuras |

## Git

- Branch principal de desenvolvimento: **`dev`**;
- trabalho isolado em branches `tarefa/<fase>-<slug>`;
- commits no formato `tipo: descrição`, em português (ver `docs/desenvolvimento.md`).

## Próxima etapa

**FASE 03 — JOGADOR** (não implementada — ver `docs/roadmap.md`).
