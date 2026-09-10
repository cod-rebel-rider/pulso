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
const CANAL_STATUS_OBTER = 'status:obter'; // igual a canais.cjs → STATUS_OBTER
const CANAL_STATUS_ALTERAR = 'status:alterar'; // igual a canais.cjs → STATUS_ALTERAR
const CANAL_MISSAO_CRIAR = 'missao:criar'; // igual a canais.cjs → MISSAO_CRIAR
const CANAL_MISSAO_LISTAR = 'missao:listar'; // igual a canais.cjs → MISSAO_LISTAR
const CANAL_MISSAO_OBTER = 'missao:obter'; // igual a canais.cjs → MISSAO_OBTER
const CANAL_MISSAO_ATUALIZAR = 'missao:atualizar'; // igual a canais.cjs → MISSAO_ATUALIZAR
const CANAL_MISSAO_INICIAR = 'missao:iniciar'; // igual a canais.cjs → MISSAO_INICIAR
const CANAL_MISSAO_CONCLUIR = 'missao:concluir'; // igual a canais.cjs → MISSAO_CONCLUIR
const CANAL_MISSAO_CANCELAR = 'missao:cancelar'; // igual a canais.cjs → MISSAO_CANCELAR
const CANAL_MISSAO_EXCLUIR = 'missao:excluir'; // igual a canais.cjs → MISSAO_EXCLUIR
const CANAL_PROGRESSAO_OBTER = 'progressao:obter'; // igual a canais.cjs → PROGRESSAO_OBTER
const CANAL_PROGRESSAO_ADICIONAR_XP = 'progressao:adicionar-xp'; // igual a canais.cjs → PROGRESSAO_ADICIONAR_XP
const CANAL_PROGRESSAO_AUMENTAR_ATRIBUTO = 'progressao:aumentar-atributo'; // igual a canais.cjs → PROGRESSAO_AUMENTAR_ATRIBUTO

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

    /**
     * Operações específicas do estado do jogador (status) — nunca acesso
     * genérico ao banco.
     */
    status: Object.freeze({
      /** @param {number} jogadorId @returns {Promise<{ok: boolean, status?: object, erro?: string, mensagem?: string}>} */
      obter: (jogadorId) => ipcRenderer.invoke(CANAL_STATUS_OBTER, { jogadorId }),

      /**
       * @param {number} jogadorId
       * @param {string} status 'energia' | 'foco' | 'estresse' | 'criatividade'
       * @param {number} delta alteração (ex.: -10, +15)
       * @returns {Promise<{ok: boolean, status?: object, erro?: string, mensagem?: string}>}
       */
      alterar: (jogadorId, status, delta) =>
        ipcRenderer.invoke(CANAL_STATUS_ALTERAR, { jogadorId, status, delta }),
    }),

    /**
     * Operações específicas de missões — nunca acesso genérico ao banco.
     */
    missao: Object.freeze({
      /**
       * Cria uma nova missão.
       * @param {{ titulo: string, descricao?: string, prioridade?: string, prazo?: string }} dados
       * @returns {Promise<{ok: boolean, missao?: object, erro?: string, campo?: string, mensagem?: string}>}
       */
      criar: (dados) => ipcRenderer.invoke(CANAL_MISSAO_CRIAR, dados),

      /**
       * Lista todas as missões do jogador.
       * @returns {Promise<{ok: boolean, missoes?: object[], erro?: string, mensagem?: string}>}
       */
      listar: () => ipcRenderer.invoke(CANAL_MISSAO_LISTAR),

      /**
       * Obtém uma missão pelo id.
       * @param {number} id
       * @returns {Promise<{ok: boolean, missao?: object, erro?: string, mensagem?: string}>}
       */
      obter: (id) => ipcRenderer.invoke(CANAL_MISSAO_OBTER, { id }),

      /**
       * Atualiza dados básicos da missão.
       * @param {{ id: number, titulo?: string, descricao?: string, prioridade?: string, prazo?: string }} dados
       * @returns {Promise<{ok: boolean, missao?: object, erro?: string, campo?: string, mensagem?: string}>}
       */
      atualizar: (dados) => ipcRenderer.invoke(CANAL_MISSAO_ATUALIZAR, dados),

      /**
       * Inicia uma missão (PENDENTE → EM_ANDAMENTO).
       * @param {number} id
       * @returns {Promise<{ok: boolean, missao?: object, erro?: string, mensagem?: string}>}
       */
      iniciar: (id) => ipcRenderer.invoke(CANAL_MISSAO_INICIAR, { id }),

      /**
       * Conclui uma missão (EM_ANDAMENTO → CONCLUÍDA).
       * @param {number} id
       * @returns {Promise<{ok: boolean, missao?: object, erro?: string, mensagem?: string}>}
       */
      concluir: (id) => ipcRenderer.invoke(CANAL_MISSAO_CONCLUIR, { id }),

      /**
       * Cancela uma missão (PENDENTE/EM_ANDAMENTO → CANCELADA).
       * @param {number} id
       * @returns {Promise<{ok: boolean, missao?: object, erro?: string, mensagem?: string}>}
       */
      cancelar: (id) => ipcRenderer.invoke(CANAL_MISSAO_CANCELAR, { id }),

      /**
       * Exclui uma missão (apenas pendentes/em andamento).
       * @param {number} id
       * @returns {Promise<{ok: boolean, erro?: string, mensagem?: string}>}
       */
      excluir: (id) => ipcRenderer.invoke(CANAL_MISSAO_EXCLUIR, { id }),
    }),

    progressao: Object.freeze({
      obter: (jogadorId) => ipcRenderer.invoke(CANAL_PROGRESSAO_OBTER, { jogadorId }),
      adicionarXp: (jogadorId, quantidade) => ipcRenderer.invoke(CANAL_PROGRESSAO_ADICIONAR_XP, { jogadorId, quantidade }),
      aumentarAtributo: (jogadorId, atributo, quantidade = 1) => ipcRenderer.invoke(CANAL_PROGRESSAO_AUMENTAR_ATRIBUTO, { jogadorId, atributo, quantidade }),
    }),
  }),
);
