# Jogador — PULSO

**Fase:** 03 — Jogador (implementada).

## 1. Conceito

O **Jogador** é a identidade persistente do operador do PULSO — a entidade central à qual os sistemas futuros (XP, missões, finanças, habilidades…) se relacionarão.

A Fase 03 implementa apenas a **identidade** do jogador. Progressão, status, atributos e demais camadas são das próximas fases.

```text
Jogador
├── Identidade         ← Fase 03 (implementada)
├── Progressão         ← Fase 06
├── Status             ← Fase 04
├── Missões            ← Fase 05
├── Finanças           ← Fase 08
├── Habilidades        ← Fase 11
└── ...                ← demais fases
```

## 2. Campos e regras

| Campo | Tipo | Regras |
| --- | --- | --- |
| `id` | INTEGER | Identificação interna única, imutável; não é o nome/codinome |
| `nome` | TEXT NOT NULL | Obrigatório; espaços aparados; máx. 60 caracteres; caracteres especiais **não são bloqueados** |
| `codinome` | TEXT | **Opcional** (null quando não informado); espaços aparados; máx. 40 caracteres |
| `criado_em` | TEXT | Carimbo ISO UTC, definido no INSERT; imutável |
| `atualizado_em` | TEXT | Carimbo ISO UTC, atualizado a cada edição |

Decisões de produto:
- **codinome opcional** — a aplicação funciona sem ele;
- **sem bloqueio de caracteres especiais** — aplicação pessoal, sem exportação para sistemas externos (não há necessidade técnica);
- **um único jogador** (single-player) — imposto pelo **Serviço** (camada de aplicação), não pelo schema (que permanece aberto a uma evolução futura de perfis múltiplos).

## 3. Primeiro acesso

```text
Banco sem jogador → Tela IDENTIDADE DO OPERADOR (configuração inicial)
  → usuário informa nome (+ codinome opcional) → INICIALIZAR → salvo em SQLite
```

- Nenhum jogador fictício é criado automaticamente.
- Banco vazio **nunca** gera erro nem tela vazia — apenas a tela de configuração.

## 4. Execuções seguintes

```text
Banco com jogador → Jogador carregado → boot com "Operador identificado"
```

A tela de criação **não** reaparece. O jogador permanece após fechar e reabrir o PULSO.

## 5. Edição

- Botão **EDITAR IDENTIDADE** na tela principal abre o formulário preenchido.
- Ao salvar: `Interface → IPC → Serviço → Domínio (validação) → Repositório → SQLite` com atualização de `atualizado_em`.
- Há **CANCELAR** para voltar sem alterar.

## 6. Validação (no domínio, não no renderer)

Viver em `src/core/dominio/jogador.js` (funções puras):

| Situação | Resultado |
| --- | --- |
| Nome vazio ou só espaços | `ErroValidacao` (campo `nome`) |
| Nome > 60 caracteres | `ErroValidacao` |
| Codinome > 40 caracteres | `ErroValidacao` (campo `codinome`) |
| Codinome vazio | `null` (opcional) |
| Dados válidos | identidade normalizada (espaços aparados), congelada |

## 7. Arquitetura

```text
Renderer (formulário; regras NÃO estão aqui)
   ↓ window.pulso.jogador.{estado,criar,atualizar}
Preload (contextBridge, sandbox)
   ↓ canais jogador:estado | jogador:criar | jogador:atualizar
Main (handlers + tradução de erros segura)
   ↓
Aplicação — ServicoJogador  (single-player, orquestração)
   ↓
Domínio — validarIdentidade/validarNome/validarCodinome
   ↓
Repositório — RepositorioJogador (SQL exclusivo aqui)
   ↓
SQLite — tabela jogador
```

A IPC expõe **apenas** operações específicas (`estado`, `criar`, `atualizar`) — nunca acesso genérico ao banco (`executeSQL`).

## 8. API interna (preload)

```js
window.pulso.jogador.estado()          → { existe, jogador|null }
window.pulso.jogador.criar({ nome, codinome? })
  → { ok, jogador } | { ok:false, erro:'validacao'|'conflito'|'interno', mensagem, campo? }
window.pulso.jogador.atualizar({ id, nome, codinome? })  → idem
```

Erros do núcleo são traduzidos em mensagens seguras — detalhes técnicos vão apenas ao log.

## 9. Persistência

`RepositorioJogador` (segue o padrão de `repositorios/meta.js`) em `src/core/database/repositorios/jogador.js`. Testes de persistência reais: salvar → fechar aplicação → reabrir → ler, em banco temporário isolado.

## 10. Testes

- **Domínio** (`tests/unidade/jogador.test.mjs`): normalização, limites, opcionalidade, especiais.
- **Integração** (`tests/integracao/jogador.test.mjs`): criar, recuperar, atualizar, existência, banco vazio, nome vazio, persistência real, bloqueio de múltiplos, evolução de migração.
- **Fumaça do Electron**: valida o fluxo IPC completo (estado → criar → re-consultar) com banco temporário.
- Todos usam bancos isolados; o banco real do usuário nunca é tocado.

## 11. Privacidade

Os dados do jogador permanecem **apenas locais** — nenhum envio a serviços externos, telemetria ou analytics.