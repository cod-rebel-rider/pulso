# src/renderer — Interface

Implementada na **Fase 01 — Fundação** (tela de inicialização do PULSO), em JavaScript vanilla (ADR-006).

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura da tela inicial, CSP restritiva e favicon em data-URI |
| `css/base.css` | Tokens da identidade visual (`--pulso-*`), reset, scanlines e acessibilidade |
| `css/principal.css` | Layout da tela: grade, trilha de rede, HUD, terminal de inicialização, rodapé |
| `js/principal.js` | Sequência de inicialização, estado do sistema e rodapé de informações reais |

Regras mantidas:

- a interface **não** acessa banco de dados, arquivos ou APIs de Node: tudo via `window.pulso` (preload);
- todos os textos em **pt-BR**;
- a tela não simula funcionalidades futuras — exibe apenas o estado real da fundação.

Princípios visuais: `docs/interface.md` e `docs/identidade-visual.md`.
