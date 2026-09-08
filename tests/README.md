# tests

Estrutura de testes do PULSO (estratégia completa em `docs/testes.md`):

```text
tests/
├── unidade/     → testes de unidades isoladas do núcleo
└── integracao/  → testes com persistência e módulos combinados (Fase 02+)
```

Comando:

```bash
npm test
```

Convenções:

- arquivos de teste terminam em `.test.mjs`;
- runner atual: `node:test` (nativo, zero dependências externas);
- descrições de teste em português;
- na Fase 00 existe apenas o **teste de sanidade do ambiente** — testes de funcionalidades serão criados junto com as próprias funcionalidades, nas fases correspondentes.
