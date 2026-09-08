# Regras do Projeto — PULSO

## 1. Princípios

1. **Local-first** — todas as funções fundamentais rodam localmente, sem depender de serviços online.
2. **Privacidade** — dados pessoais ficam na máquina do usuário, fora do repositório. Nunca versionar dados pessoais, senhas, tokens, chaves de API ou caminhos pessoais.
3. **Offline-first** — funções essenciais funcionam sem internet; a rede é sempre opcional.
4. **Modularidade** — módulos independentes com interfaces claras (ver `arquitetura.md`).
5. **Extensibilidade** — novas funcionalidades não devem exigir reescrever o núcleo.
6. **Dados persistentes** — o estado do usuário vive em banco local (SQLite, a partir da Fase 02).

## 2. Idioma (pt-BR)

- **Português do Brasil** é obrigatório em: interface, mensagens ao usuário, nomes de funcionalidades, documentação, mensagens de commit e descrições de teste.
- Identificadores de código (variáveis, funções) e diretórios técnicos (ex.: `src/main`) podem ficar em inglês quando essa for a convenção da tecnologia — mas **todo texto exibido ao usuário é pt-BR**.

| Errado (na interface) | Correto |
| --- | --- |
| New Quest | Nova Missão |
| Wallet | Carteira |
| Settings | Configurações |
| Skill Tree | Árvore de Habilidades |
| Purchase | Compra |

## 3. Convenções de código

- JavaScript moderno (ESM, `"type": "module"`); indentação de 2 espaços; UTF-8; fim de linha LF (ver `.editorconfig` na raiz).
- Nomes de arquivos de código em kebab-case (ex.: `verificar-ambiente.mjs`); a convenção de componentes/telas será definida na Fase 01.
- **Zero dependências externas na Fase 00**; toda dependência nova deve ser justificada e registrada na fase correspondente.
- Linter/formatter (ESLint/Prettier) — pendência registrada para a Fase 01 (ver `pendencias.md`).

## 4. Convenções de Git

- Branch principal de desenvolvimento: **`dev`**.
- Branches de trabalho nascem de `dev`: `tarefa/<fase>-<slug>` (ex.: `tarefa/fase-00-preparacao`) ou `correcao/<slug>`.
- Nada é commitado diretamente em `dev` quando o trabalho puder ser isolado em uma branch.
- Integração via **Pull Request** para `dev` quando houver remote; em repositório local, merge `--no-ff` com mensagem descritiva.
- Commits pequenos, no formato `tipo: descrição`, **em português**. Tipos: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `style`, `perf`, `build`.

## 5. Limites entre fases

- **Não antecipar funcionalidades** de fases futuras. Ao identificar uma necessidade futura: documentar e registrar em `docs/pendencias.md`.
- Cada fase termina somente quando seus critérios de conclusão estão satisfeitos.
- Evitar "melhorias" fora do escopo: **preparar vem antes de programar**.

## 6. Privacidade e segredos

- `.env`, credenciais e dados do usuário nunca entram no repositório (proteções no `.gitignore`).
- O banco de dados do usuário viverá fora do repositório a partir da Fase 02.
- Nenhum caminho pessoal (home, pastas privadas) deve aparecer em código ou documentação.
