# Desenvolvimento — PULSO

Guia para desenvolvedores (e IAs) trabalharem no projeto.

## 1. Requisitos

| Ferramenta | Versão mínima | Observação |
| --- | --- | --- |
| Linux (Ubuntu) | 26.04 testado | desenvolvimento e testes iniciais apenas no Linux |
| Node.js | 20 LTS | `node --version` |
| npm | 10 | vem com o Node |
| Git | 2.40 | controle de versão |
| sqlite3 (CLI) | 3.45 | **opcional** nesta fase — útil a partir da Fase 02 (`sudo apt install sqlite3`) |

Para verificar tudo de uma vez:

```bash
npm run verificar-ambiente
```

## 2. Instalação

```bash
git clone <url-do-repositorio>   # quando houver remote
cd pulso
npm install                      # Fase 00: nenhuma dependência externa
```

## 3. Comandos

| Comando | O que faz |
| --- | --- |
| `npm start` | Inicia a aplicação desktop (janela do PULSO) |
| `npm test` | Testes unitários + teste de fumaça do Electron (inicia/encerra a app 2×) |
| `npx electron . --teste-fumaca` | Teste de fumaça direto: valida inicialização e imprime relatório JSON |
| `npm run verificar-ambiente` | Relatório do ambiente (Node, npm, Git, Electron, estrutura) |

**Requisito dos testes de integração:** sessão gráfica ativa (X11/Wayland) ou `xvfb-run` (`sudo apt install xvfb`).

## 4. Fluxo de trabalho (branches)

```text
main   → histórico estável (receberá conteúdo no primeiro marco estável)
dev    → branch principal de desenvolvimento
tarefa/* e correcao/* → trabalho isolado, nascidas de dev
```

Passos:

1. `git checkout dev && git pull` (quando houver remote);
2. `git checkout -b tarefa/fase-XX-nome` a partir de `dev`;
3. commits pequenos e descritivos;
4. validar com `npm test`;
5. abrir Pull Request para `dev` (ou merge `--no-ff` local, documentando);
6. apagar a branch da tarefa após a integração.

**Nunca desenvolver diretamente em `dev`** quando o trabalho puder ser isolado.

## 5. Convenção de commits

Formato: `tipo: descrição` — sempre em português, em letras minúsculas, frases curtas.

Tipos: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `style`, `perf`, `build`.

Exemplos:

```text
docs: adicionar documentação inicial
chore: preparar estrutura do projeto
chore: configurar dependências iniciais
test: configurar ambiente de testes
```

## 6. Configuração e segredos

- Ambientes separados em `config/` (`desenvolvimento.json`, `teste.json`, `producao.json`) — ver `config/README.md`.
- **Nunca** commitar senhas, tokens, chaves de API, dados pessoais ou caminhos pessoais.
- Possíveis `.env` ficam no `.gitignore`; apenas `.env.exemplo` poderia ser versionado.

## 7. Estrutura do repositório

```text
pulso/
├── src/            → código-fonte (main, renderer, core/database, modules)
├── database/       → (reservado) recursos versionados de banco — migrações vivem em src/core/database
├── assets/         → recursos visuais e fontes locais
├── config/         → configurações por ambiente
├── scripts/        → ferramentas de desenvolvimento
├── tests/          → testes (unidade, integração)
├── docs/           → documentação do projeto
├── package.json
├── .gitignore
└── .editorconfig
```

O **banco de dados do usuário** fica fora do repositório (ex.: `~/.config/pulso/pulso.db`) — detalhes e backup manual em `docs/banco-de-dados.md`.

## 8. Solução de problemas

| Problema | Solução |
| --- | --- |
| Node antigo ou ausente | instalar via nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh \| bash && nvm install 20` |
| Git sem identidade | `git config --global user.name "Seu Nome"` e `git config --global user.email "voce@exemplo.com"` |
| `sqlite3` ausente | opcional até a Fase 02: `sudo apt install sqlite3` |
| Testes de integração falham sem display | instalar `xvfb` (`sudo apt install xvfb`) ou executar em sessão gráfica |
| Electron 39/41+ quebra com SIGSEGV neste sistema | manter Electron 37.x (fixado) — ver ADR-008; retestar upgrades com `npm test` |
| "Outra instância do PULSO já está em execução" | fechar a janela aberta anteriormente e iniciar de novo |
| Onde ficam os meus dados? | fora do repositório — ver `docs/banco-de-dados.md` (localização e backup manual) |
