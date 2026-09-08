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
const CANAL_BANCO_INFO = 'banco:info'; // igual a canais.cjs → BANCO_INFO
const CANAL_JOGADOR_ESTADO = 'jogador:estado'; // igual a canais.cjs → JOGADOR_ESTADO
const CANAL_JOGADOR_CRIAR = 'jogador:criar'; // igual a canais.cjs → JOGADOR_CRIAR
const CANAL_JOGADOR_ATUALIZAR = 'jogador:atualizar'; // igual a canais.cjs → JOGADOR_ATUALIZAR

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

    /**
     * Estado real do banco de dados local (somente leitura, sem caminhos).
     * @returns {Promise<{nome: string, estado: string, versaoSchema: number}>}
     */
    infoBanco: () => ipcRenderer.invoke(CANAL_BANCO_INFO),

    /**
     * Operações específicas do jogador — nunca acesso genérico ao banco.
     */
    jogador: Object.freeze({
      /** @returns {Promise<{existe: boolean, jogador: object|null, falha?: boolean}>} */
      estado: () => ipcRenderer.invoke(CANAL_JOGADOR_ESTADO),

      /**
       * Cria o jogador (primeiro acesso).
       * @param {{ nome: string, codinome?: string }} dados
       * @returns {Promise<{ok: boolean, jogador?: object, erro?: string, campo?: string, mensagem?: string}>}
       */
      criar: (dados) => ipcRenderer.invoke(CANAL_JOGADOR_CRIAR, dados),

      /**
       * Atualiza a identidade do jogador.
       * @param {{ id: number, nome: string, codinome?: string }} dados
       * @returns {Promise<{ok: boolean, jogador?: object, erro?: string, campo?: string, mensagem?: string}>}
       */
      atualizar: (dados) => ipcRenderer.invoke(CANAL_JOGADOR_ATUALIZAR, dados),
    }),
  }),
);
