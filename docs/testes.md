# Testes — PULSO

## 1. Estratégia

Pirâmide clássica, respeitando o ritmo das fases:

1. **Unidade** — domínio e casos de uso puros (regras de XP, missões, cálculos financeiros). Rápidos e numerosos.
2. **Integração** — módulos + persistência real (SQLite em arquivo temporário), a partir da Fase 02; e, desde a Fase 01, o ciclo de inicialização da aplicação.
3. **Extremo a extremo (e2e)** — interface Electron automatizada com ferramenta dedicada; a decidir na Fase 17 (registrada em `pendencias.md`).

## 3. Infraestrutura atual (Fase 02)

- Runner: **`node:test`** executado com o **Node embutido do Electron** — `npm test` → `ELECTRON_RUN_AS_NODE=1 electron --test "tests/**/*.test.mjs"` (o `node:sqlite` exige o runtime da aplicação; o Node do sistema 20.x não o possui).
- Estrutura:

```text
tests/
├── unidade/      → ambiente, configuração, registro, canais IPC, conexão, migrações, jogador, status, missão
└── integracao/   → inicialização da aplicação (fumaça), persistência real do banco, jogador, status, missão
```

## 4. Teste de fumaça (Fases 01–02)

O processo principal aceita a flag `--teste-fumaca`:

```bash
npx electron . --teste-fumaca
```

Ele inicia a aplicação, cria a janela, carrega o renderer, valida a ponte IPC, coleta erros de console do renderer, imprime `PULSO_FUMACA:{relatório JSON}` no stdout e encerra sozinho. Os testes de integração em `tests/integracao/inicializacao.test.mjs` executam **dois ciclos completos** (iniciar → encerrar → iniciar novamente), cobrindo:

1. dependências instaladas (Electron resolvível);
2. aplicação inicia;
3. janela criada;
4. renderer carregado;
5. HTML/CSS/JS carregam (sinal de prontidão do renderer, sem erros de console);
6. encerramento sem erros;
7. reinício após encerramento;
8. nenhum erro inesperado no console.

**Requisito de ambiente:** sessão gráfica (X11/Wayland) ou `xvfb-run` (`sudo apt install xvfb`) para execução headless.

## 5. Convenções

- arquivos de teste terminam em `.test.mjs`;
- descrições de teste em **português**;
- testes não dependem de rede nem de dados pessoais;
- configurações de teste usam `PULSO_AMBIENTE=teste` e `config/teste.json`.

## 6. O que testar por camada

| Camada | Tipo | Observação |
| --- | --- | --- |
| Domínio | unidade | funções puras, sem E/S |
| Aplicação | unidade/integração | casos de uso com repositórios simulados ou banco temporário |
| Persistência | integração | SQLite em arquivo temporário (Fase 02+) |
| Processo principal + janela | integração | teste de fumaça (Fase 01) |
| Persistência (SQLite) | unidade + integração | conexão/PRAGMAs, migrações e ciclo salvar→reabrir→ler em bancos isolados (Fase 02) |
| Interface | e2e | automação dedicada (Fase 17) |

## 7. Regras

- **Não criar testes de funcionalidades que ainda não existem.**
- Cobertura de código: meta a definir na Fase 17 (o runner nativo oferece `--experimental-test-coverage` quando necessário).
- `npm test` deve sempre terminar sem erros em `dev`.
