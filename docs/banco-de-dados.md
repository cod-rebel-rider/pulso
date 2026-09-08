# Banco de Dados — PULSO

**Fase responsável:** 02 — Banco de Dados (nada implementado ainda).

## 1. Decisão: SQLite

O PULSO utilizará **SQLite** como persistência local.

Justificativa:

- banco em **arquivo único**, sem servidor — perfeito para local-first e privacidade;
- transações confiáveis e suporte amplo no ecossistema Node/Electron;
- facilita backups (copiar um arquivo) e a futura portabilidade (Fase 18);
- funciona offline por natureza.

## 2. Driver (decisão pendente da Fase 02)

Candidatos a avaliar quando a Fase 02 iniciar:

| Opção | Observações |
| --- | --- |
| `node:sqlite` (módulo nativo do Node) | Disponível a partir do Node 22.5+; depende da versão do Node embutida no Electron escolhido na Fase 01 |
| `better-sqlite3` | Maduro, síncrono e rápido; requer compilação/rebuild compatível com a ABI do Electron (electron-rebuild) |

Critérios da decisão: compatibilidade com a versão do Electron, desempenho, simplicidade e manutenção.

## 3. Local dos dados

- O **arquivo de banco do usuário** ficará fora do repositório, no diretório de dados do sistema operacional (caminho exato definido na Fase 02).
- Nada de dados pessoais no repositório — regra permanente (ver `regras-do-projeto.md`).

## 4. Estrutura conceitual futura (sem DDL nesta fase)

Domínios previstos, apenas como mapa mental para as fases seguintes:

- **Jogador / Status / Progressão** — identidade do jogador, atributos, estados, XP e níveis;
- **Missões / Projetos** — missões, projetos e seus vínculos;
- **Finanças / Loja / Serviços** — transações, carteira, categorias, itens, desejos, compras e recorrências;
- **Habilidades** — habilidades e desbloqueios;
- **Música** — peças/faixas e acompanhamento de prática;
- **Mapa / Trilha** — nós, conexões e progresso;
- **Conquistas** — conquistas e condições de desbloqueio.

A modelagem detalhada (tabelas, índices, relacionamentos), a estratégia de **migrações versionadas** em `database/` e a rotina de **backup** do arquivo de banco serão definidas e documentadas na Fase 02.

## 5. Ferramentas do ambiente

- O CLI `sqlite3` **não está instalado** no ambiente atual. É opcional nesta fase (o driver virá via npm na Fase 02), mas útil para inspeção manual do banco.
- Instalação (opcional): `sudo apt install sqlite3` (versão recomendada: 3.45 ou superior).
- Alternativa gráfica opcional: DB Browser for SQLite.
