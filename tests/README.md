# tests

Estrutura de testes do PULSO (estratégia completa em `docs/testes.md`):

```text
tests/
├── unidade/                 → suíte original: unidades isoladas do núcleo
├── integracao/*.test.mjs    → suíte original: módulos + persistência (Fase 02+)
├── fases/                   → HOMOLOGAÇÃO: 1 arquivo por fase (01–09)
├── integracao/homologacao/  → HOMOLOGAÇÃO: pares de fases + fluxos-completos/
├── criticos/                → HOMOLOGAÇÃO: persistência, integridade, dinheiro, XP
└── utils/                   → HOMOLOGAÇÃO: ambiente-homologacao.mjs (banco temporário)
```

Comandos:

```bash
npm test                # suíte original (unidade + integração)
npm run test:homologacao# homologação completa + relatório em relatorios/
npm run test:fases       # só fases 01–09 + relatório
npm run test:integracao  # só integrações + relatório
npm run test:criticos    # só críticos + relatório
```

Convenções:

- arquivos de teste terminam em `.test.mjs`;
- runner atual: `node:test` (nativo, zero dependências externas);
- descrições de teste em português;
- na Fase 00 existe apenas o **teste de sanidade do ambiente** — testes de funcionalidades serão criados junto com as próprias funcionalidades, nas fases correspondentes.
- homologação: títulos `Fase → Funcionalidade → Cenário`; bancos sempre
  temporários (`tests/utils/ambiente-homologacao.mjs`); banco real nunca tocado.
- detalhes da homologação (relatórios, criticidade, como adicionar testes):
  ver `tests/homologacao-README.md`.
