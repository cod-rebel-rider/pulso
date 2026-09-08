/**
 * PULSO — Preload (Fase 01 — Fundação)
 *
 * Ponte controlada entre renderer e processo principal:
 *
 *   Renderer  ↕  window.pulso (contextBridge)  ↕  Main
 *
 * - o renderer é executado com sandbox: true, contextIsolation: true e
 *   nodeIntegration: false (ver src/main/janela.js);
 * - nenhuma API de Node.js é exposta ao renderer;
 * - a superfície de comunicação é mínima e explícita.
 *
 * Observação: preload em sandbox não pode requerer arquivos locais, então
 * os nomes de canais são replicados aqui em sincronia com
 * src/main/canais.cjs (os testes verificam a consistência).
 */

const CANAL_INFO_SISTEMA = 'info:sistema'; // igual a canais.cjs → INFO_SISTEMA

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'pulso',
  Object.freeze({
    /**
     * Informações reais do sistema da aplicação (somente leitura).
     * @returns {Promise<{nome: string, versao: string, ambiente: string,
     *   plataforma: string, electron: string, node: string, chrome: string,
     *   dataHora: string}>}
     */
    infoSistema: () => ipcRenderer.invoke(CANAL_INFO_SISTEMA),
  }),
);
