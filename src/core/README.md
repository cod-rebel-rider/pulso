# src/core — Núcleo

Camadas de **aplicação, domínio e persistência**, independentes do Electron (testáveis sem janela). A **persistência já está implementada** (Fase 02):

```text
core/
├── database/
│   ├── conexao.js              → abrir/configurar/fechar SQLite (node:sqlite) + integridade
│   ├── migracoes.js            → lista de migrações + executor transacional + versaoAtual
│   ├── inicializar.js          → localizar/criar → conectar → migrar → validar
│   └── repositorios/
│       └── meta.js             → RepositorioMeta (padrão de repositório do PULSO)
├── aplicacao/    → casos de uso e orquestração (fases futuras)
└── dominio/      → entidades e regras de negócio (fases futuras)
```

Regras de dependência: `aplicacao → dominio → persistencia`. O domínio nunca depende de interface nem da tecnologia de banco; **SQL vive somente nos repositórios**. Detalhes da persistência em `docs/banco-de-dados.md`.
