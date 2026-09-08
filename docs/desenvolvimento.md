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
| `npm start` | Nesta fase: relatório de verificação do ambiente. A partir da Fase 01: inicia o aplicativo |
| `npm test` | Executa a suíte de testes (`node --test tests/`) |
| `npm run verificar-ambiente` | Relatório do ambiente (Node, npm, Git, estrutura) |

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
├── src/            → código-fonte (main, renderer, core, modules)
├── database/       → esquemas e migrações (Fase 02)
├── assets/         → recursos visuais e fontes locais
├── config/         → configurações por ambiente
├── scripts/        → ferramentas de desenvolvimento
├── tests/          → testes (unidade, integração)
├── docs/           → documentação do projeto
├── package.json
├── .gitignore
└── .editorconfig
```

## 8. Solução de problemas

| Problema | Solução |
| --- | --- |
| Node antigo ou ausente | instalar via nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh \| bash && nvm install 20` |
| Git sem identidade | `git config --global user.name "Seu Nome"` e `git config --global user.email "voce@exemplo.com"` |
| `sqlite3` ausente | opcional nesta fase: `sudo apt install sqlite3` |
