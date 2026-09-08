# src/main — Processo Principal (Electron)

Implementado na **Fase 01 — Fundação**.

| Arquivo | Responsabilidade |
| --- | --- |
| `main.js` | Ponto de entrada (`package.json → main`): ciclo de vida, instância única, IPC, erros globais e modo `--teste-fumaca` |
| `janela.js` | Criação da janela segura (`contextIsolation`, `sandbox`, `nodeIntegration: false`) e diagnósticos |
| `configuracao.js` | Carrega `config/<ambiente>.json` (`PULSO_AMBIENTE` → teste; empacotado → produção; padrão → desenvolvimento) |
| `registro.js` | Log identificável no console: `[PULSO][ISO][NÍVEL] mensagem` |
| `canais.cjs` | Definição central dos canais IPC (`info:sistema`) |
| `preload.cjs` | Ponte `window.pulso` (contextBridge); CommonJS por causa do sandbox |

Os módulos de núcleo (aplicação, domínio, persistência) virão em `src/core/` nas próximas fases — ver `docs/arquitetura.md`.
