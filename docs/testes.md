# Testes — PULSO

## 1. Estratégia

Pirâmide clássica, respeitando o ritmo das fases:

1. **Unidade** — domínio e casos de uso puros (regras de XP, missões, cálculos financeiros). Rápidos e numerosos.
2. **Integração** — módulos + persistência real (SQLite em arquivo temporário), a partir da Fase 02.
3. **Extremo a extremo (e2e)** — interface Electron automatizada; ferramenta a decidir na Fase 17 (registrada em `pendencias.md`).

## 2. Infraestrutura atual (Fase 00)

- Runner: **`node:test`** (nativo do Node, zero dependências externas).
- Comando: `npm test`.
- Estrutura:

```text
tests/
├── unidade/     → unidades isoladas do núcleo
└── integracao/  → módulos + persistência combinados (Fase 02+)
```

## 3. Convenções

- arquivos de teste terminam em `.test.mjs`;
- descrições de teste em **português**;
- um diretório de testes por tipo (unidade, integração; e2e quando existir);
- testes não devem depender de rede nem de dados pessoais;
- configurações de teste usam `config/teste.json` e locais temporários.

## 4. O que testar por camada

| Camada | Tipo | Observação |
| --- | --- | --- |
| Domínio | unidade | funções puras, sem E/S |
| Aplicação | unidade/integração | casos de uso com repositórios simulados ou banco temporário |
| Persistência | integração | SQLite em arquivo temporário (Fase 02+) |
| Interface | e2e | automação da janela Electron (Fase 17) |

## 5. Regras

- **Não criar testes de funcionalidades que ainda não existem.** Na Fase 00 existe apenas o teste de sanidade do ambiente e da estrutura.
- Cobertura de código: meta a definir na Fase 17 (o runner nativo oferece `--experimental-test-coverage` quando necessário).
- `npm test` deve sempre terminar sem erros em `dev`.
