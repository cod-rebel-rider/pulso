# Arquitetura — PULSO

**Fase:** 00 — Preparação (documentação inicial; nada implementado além da estrutura).

## 1. Visão geral

O PULSO é uma aplicação desktop local-first organizada em camadas com dependência **unidirecional**:

```text
┌──────────────────────────────────────────────┐
│ interface      (src/renderer)                │  o que o usuário vê e usa
└───────────────┬──────────────────────────────┘
                ↓  (IPC — Fase 01)
┌──────────────────────────────────────────────┐
│ aplicação      (src/main + src/core/aplicacao) │  orquestra casos de uso
└───────────────┬──────────────────────────────┘
                ↓
┌──────────────────────────────────────────────┐
│ domínio        (src/core/dominio)            │  regras de negócio (XP, missões, finanças…)
└───────────────┬──────────────────────────────┘
                ↓
┌──────────────────────────────────────────────┐
│ persistência   (src/core/persistencia + database/) │  SQLite (Fase 02)
└──────────────────────────────────────────────┘
```

Regras estruturais:

1. Cada camada só conhece a camada imediatamente abaixo.
2. A interface **nunca** acessa banco de dados, arquivos ou recursos do SO diretamente — sempre via camada de aplicação.
3. O **domínio é puro**: sem Electron, sem SQLite, sem dependência de interface — por isso é testável de forma isolada.
4. Módulos de funcionalidade vivem em `src/modules/<modulo>` e conversam com o núcleo por interfaces explícitas, nunca "por baixo".

## 2. Responsabilidades por camada

| Camada | Diretório | Responsabilidade |
| --- | --- | --- |
| Interface | `src/renderer` | Telas, componentes, estilos, feedback visual |
| Processo principal | `src/main` | Ciclo de vida do aplicativo, janela, ponte IPC, integração com o SO |
| Aplicação | `src/core/aplicacao` | Casos de uso ("criar missão", "registrar transação"), orquestração |
| Domínio | `src/core/dominio` | Entidades e regras (jogador, atributos, XP, missões, finanças) |
| Persistência | `src/core/persistencia` | Repositórios, acesso ao SQLite, migrações |
| Módulos | `src/modules` | Funcionalidades independentes com contrato público documentado |

## 3. Comunicação

- **Interface ↔ núcleo:** via IPC do Electron (a partir da Fase 01), com canais nomeados por módulo e mensagens estruturadas (ex.: canal `missao:listar`). O renderer recebe apenas dados já processados.
- **Módulo ↔ módulo:** preferencialmente indireto, por meio da camada de aplicação. Acoplamento direto entre módulos deve ser evitado; quando necessário, deve estar explícito no contrato do módulo.
- **Núcleo ↔ banco:** exclusivamente pela camada de persistência, por meio de repositórios (interfaces definidas na Fase 02).

## 4. Módulos previstos (apenas planejados — nenhum implementado)

`Missões · Projetos · Jogador · Status · Progressão · Finanças · Loja · Serviços · Habilidades · Música · Mapa · Conquistas`

Quando implementados, cada módulo deverá ter: domínio próprio, casos de uso próprios, contrato público documentado e testes próprios. A granularidade exata será decidida fase a fase.

## 5. Decisões técnicas (registro de decisões — ADR)

### ADR-001 — Electron como plataforma desktop

**Decisão:** manter **Electron + HTML/CSS/JavaScript**, conforme o planejamento original.

**Vantagens:** runtime web completo para a interface Cyberpunk pretendida (animações, canvas, WebGL); acesso nativo a arquivos e ao SO; SQLite funciona bem via drivers Node; empacotamento maduro para Linux e Windows (necessário na Fase 18, inclusive executável para pendrive); comunidade e documentação abundantes; um único código para os dois sistemas.

**Desvantagens:** consumo maior de memória e disco (binário grande); inicialização mais lenta que aplicativos nativos; exige disciplina de segurança (sem integração Node no renderer, com isolamento de contexto).

**Impacto:**

- **Linux (foco atual):** excelente suporte (AppImage/deb/tar.gz); desenvolvimento direto no Ubuntu.
- **Windows (Fase 18):** o mesmo código gera o pacote Windows, sem retrabalho.
- **Pendrive (Fase 18):** Electron permite builds portáteis; os caminhos de dados serão abstraídos desde cedo para não quebrar nesse cenário.
- **SQLite:** maduro via drivers Node (decisão do driver na Fase 02 — ver `banco-de-dados.md`).
- **Manutenção:** stack única (JavaScript) de ponta a ponta; o Electron atualiza com frequência e as versões precisam ser acompanhadas.

**Alternativas avaliadas:**

| Alternativa | Prós | Contras | Veredito |
| --- | --- | --- | --- |
| Tauri (Rust) | binário ~10 MB, muito leve | exige toolchain Rust; webview varia por SO; SQLite via plugin; curva extra para projeto solo em JS | descartada — complexidade sem ganho essencial |
| NW.js | similar ao Electron | comunidade em declínio | descartada |
| Web app + servidor Node local | leve, sem empacotar browser | experiência menos integrada; gestão de porta/servidor; UX de janela pior | descartada |
| Nativo (GTK/Qt) | desempenho e leveza | stack diferente de web; desenvolvimento mais lento para a interface rica pretendida | descartada |

### ADR-002 — JavaScript moderno (ESM) e framework de interface

- Projeto com `"type": "module"` e sintaxe ESM em todo o código.
- A escolha de framework/biblioteca de UI (ou vanilla) **ainda não foi feita** — está registrada em `pendencias.md` para a Fase 01, quando a primeira janela existir. Não antecipar.

### ADR-003 — SQLite como persistência (a partir da Fase 02)

- Banco em arquivo único, sem servidor — ideal para local-first. Detalhes e pendências em `banco-de-dados.md`.

### ADR-004 — Runner de testes nativo (`node:test`)

- Zero dependências externas na Fase 00; reavaliar apenas se a Fase 01 trouxer necessidade real.

## 6. Preparação para a portabilidade (Fase 18 — nada implementado)

Para não fechar portas no futuro:

- caminhos de dados sempre resolvidos por abstração (diretório de dados do SO), nunca hardcoded;
- assets referenciados de forma relativa/empacotada;
- nenhuma dependência de rede para funções essenciais (offline-first);
- ferramenta de empacotamento (electron-builder / electron-forge) será escolhida na Fase 18.

## 7. Segurança (quando o Electron existir)

- `contextIsolation: true` e `nodeIntegration: false` no renderer;
- validação de tudo que cruza a barreira IPC;
- nenhuma credencial no repositório (ver `regras-do-projeto.md`).
