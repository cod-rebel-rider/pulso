# Homologação — PULSO (branch `homologacao`)

Suíte de validação do estado real do código (Fases 00–08 concluídas;
Fase 09 pendente). Não corrige a aplicação: apenas verifica e relata.

## Layout

```text
tests/
├── fases/                  → 1 arquivo por fase (01–09)
├── integracao/homologacao/ → pares de fases + fluxos-completos/
├── criticos/               → persistência, integridade, finanças, progressão
├── utils/                  → ambiente-homologacao.mjs (banco temporário + fiação)
├── unidade/                → suíte original do projeto (inalterada)
└── integracao/*.test.mjs   → suíte original do projeto (inalterada)

scripts/homologacao/        → executor (nucleo + relatório + montar-relatório)
relatorios/                 → REL-XXXX_Pulso-X.Y.Z_SO_DATA_HORA.md
```

## Pré-requisitos

- Node ≥ 20, npm ≥ 10, dependências instaladas (`npm install`);
- runtime com `node:sqlite` = Electron embutido (os scripts chamam
  `node_modules/.bin/electron --test` com `ELECTRON_RUN_AS_NODE=1`).

## Como executar

```bash
npm run test:homologacao  # tudo + relatório em relatorios/
npm run test:fases         # só fases 01–09 + relatório
npm run test:integracao    # só integrações + relatório
npm run test:criticos      # só críticos + relatório
npm test                   # suíte original (regressão geral)
```

Cada execução gera `relatorios/REL-XXXX_Pulso-<versão>_<SO>_<data>_<hora>.md`
com ID sequencial único (nunca reutilizado).

## Relatórios

`relatorios/` na raiz — seções: Introdução, Fases, Fases Críticas,
Sugestões, Conclusão (🟢 APTO / 🟡 APTO COM RESSALVAS / 🔴 NÃO APTO).

## Interpretação

- `✅ APROVADO` / `❌ REPROVADO` por fase; severidade crítica em
  `tests/criticos/` (persistência, FK/CASCADE, saldo derivado, XP).
- Ausências deliberadas (XP/recompensa automática P-022/P-024, loja Fase 09)
  documentadas como comportamento real, não defeito.

## Dados de teste

Bancos temporários (`mkdtemp` + `aplicarMigracoes` + `rmSync`).
O banco real (`~/.config/pulso/pulso.db`) nunca é tocado.

## Adicionar novos testes

1. Fase individual → `tests/fases/fase-NN-<slug>.test.mjs`;
2. Par de fases → `tests/integracao/homologacao/<a>-<b>.test.mjs`;
3. Fluxo → `tests/integracao/homologacao/fluxos-completos/*.test.mjs`;
4. Crítico → `tests/criticos/<tema>.test.mjs`;
5. Usar `criarBancoTemporario/destruirBancoTemporario/criarServicos`
   de `tests/utils/ambiente-homologacao.mjs`;
6. Títulos no padrão `Fase → Funcionalidade → Cenário`;
7. Rodar `npm run test:homologacao` e conferir o relatório.
