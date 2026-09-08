# src/core — Núcleo

Destinado às camadas de **aplicação, domínio e persistência**, independentes do Electron sempre que possível (assim o núcleo pode ser testado sem abrir janela).

Estrutura conceitual prevista (a implementar a partir das Fases 01 e 02):

```text
core/
├── aplicacao/    → casos de uso e orquestração
├── dominio/      → entidades e regras de negócio
└── persistencia/ → acesso a dados (SQLite — Fase 02)
```

Regra de dependência: `aplicacao → dominio → persistencia`. O domínio nunca depende de interface nem da tecnologia de banco.

Os módulos de funcionalidade (missões, finanças, música etc.) viverão em `src/modules/` e usarão o núcleo por meio de interfaces explícitas — ver `docs/arquitetura.md`.
