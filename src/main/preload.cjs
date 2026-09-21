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
const CANAL_PROJETO_CRIAR = 'projeto:criar'; // igual a canais.cjs → PROJETO_CRIAR
const CANAL_PROJETO_LISTAR = 'projeto:listar'; // igual a canais.cjs → PROJETO_LISTAR
const CANAL_PROJETO_OBTER = 'projeto:obter'; // igual a canais.cjs → PROJETO_OBTER
const CANAL_PROJETO_ATUALIZAR = 'projeto:atualizar'; // igual a canais.cjs → PROJETO_ATUALIZAR
const CANAL_PROJETO_INICIAR = 'projeto:iniciar'; // igual a canais.cjs → PROJETO_INICIAR
const CANAL_PROJETO_CONCLUIR = 'projeto:concluir'; // igual a canais.cjs → PROJETO_CONCLUIR
const CANAL_PROJETO_CANCELAR = 'projeto:cancelar'; // igual a canais.cjs → PROJETO_CANCELAR
const CANAL_PROJETO_ARQUIVAR = 'projeto:arquivar'; // igual a canais.cjs → PROJETO_ARQUIVAR
const CANAL_PROJETO_ASSOCIAR_MISSAO = 'projeto:associar-missao'; // igual a canais.cjs → PROJETO_ASSOCIAR_MISSAO
const CANAL_PROJETO_REMOVER_MISSAO = 'projeto:remover-missao'; // igual a canais.cjs → PROJETO_REMOVER_MISSAO
const CANAL_FINANCA_CARTEIRA = 'financa:carteira'; // igual a canais.cjs → FINANCA_CARTEIRA
const CANAL_FINANCA_SALDO = 'financa:saldo'; // igual a canais.cjs → FINANCA_SALDO
const CANAL_FINANCA_RESUMO = 'financa:resumo'; // igual a canais.cjs → FINANCA_RESUMO
const CANAL_FINANCA_LISTAR_TRANSACOES = 'financa:listar-transacoes'; // igual a canais.cjs → FINANCA_LISTAR_TRANSACOES
const CANAL_FINANCA_CRIAR_TRANSACAO = 'financa:criar-transacao'; // igual a canais.cjs → FINANCA_CRIAR_TRANSACAO
const CANAL_FINANCA_ATUALIZAR_TRANSACAO = 'financa:atualizar-transacao'; // igual a canais.cjs → FINANCA_ATUALIZAR_TRANSACAO
const CANAL_FINANCA_EXCLUIR_TRANSACAO = 'financa:excluir-transacao'; // igual a canais.cjs → FINANCA_EXCLUIR_TRANSACAO
const CANAL_FINANCA_LISTAR_ORCAMENTOS = 'financa:listar-orcamentos'; // igual a canais.cjs → FINANCA_LISTAR_ORCAMENTOS
const CANAL_FINANCA_CRIAR_ORCAMENTO = 'financa:criar-orcamento'; // igual a canais.cjs → FINANCA_CRIAR_ORCAMENTO
const CANAL_FINANCA_ATUALIZAR_ORCAMENTO = 'financa:atualizar-orcamento'; // igual a canais.cjs → FINANCA_ATUALIZAR_ORCAMENTO
const CANAL_FINANCA_EXCLUIR_ORCAMENTO = 'financa:excluir-orcamento'; // igual a canais.cjs → FINANCA_EXCLUIR_ORCAMENTO
const CANAL_FINANCA_SITUACAO_ORCAMENTO = 'financa:situacao-orcamento'; // igual a canais.cjs → FINANCA_SITUACAO_ORCAMENTO
const CANAL_LOJA_LISTAR = 'loja:listar'; // igual a canais.cjs → LOJA_LISTAR
const CANAL_LOJA_OBTER = 'loja:obter'; // igual a canais.cjs → LOJA_OBTER
const CANAL_LOJA_CRIAR = 'loja:criar'; // igual a canais.cjs → LOJA_CRIAR
const CANAL_LOJA_ATUALIZAR = 'loja:atualizar'; // igual a canais.cjs → LOJA_ATUALIZAR
const CANAL_LOJA_ANALISAR = 'loja:analisar'; // igual a canais.cjs → LOJA_ANALISAR
const CANAL_LOJA_PLANEJAR = 'loja:planejar'; // igual a canais.cjs → LOJA_PLANEJAR
const CANAL_LOJA_COMPRAR = 'loja:comprar'; // igual a canais.cjs → LOJA_COMPRAR
const CANAL_LOJA_CANCELAR = 'loja:cancelar'; // igual a canais.cjs → LOJA_CANCELAR
const CANAL_LOJA_HISTORICO = 'loja:historico'; // igual a canais.cjs → LOJA_HISTORICO
const CANAL_LOJA_RESUMO = 'loja:resumo'; // igual a canais.cjs → LOJA_RESUMO
const CANAL_LOJA_CONFIG = 'loja:config'; // igual a canais.cjs → LOJA_CONFIG
const CANAL_SERVICO_LISTAR = 'servico:listar'; // igual a canais.cjs → SERVICO_LISTAR
const CANAL_SERVICO_OBTER = 'servico:obter'; // igual a canais.cjs → SERVICO_OBTER
const CANAL_SERVICO_CRIAR = 'servico:criar'; // igual a canais.cjs → SERVICO_CRIAR
const CANAL_SERVICO_ATUALIZAR = 'servico:atualizar'; // igual a canais.cjs → SERVICO_ATUALIZAR
const CANAL_SERVICO_ATIVAR = 'servico:ativar'; // igual a canais.cjs → SERVICO_ATIVAR
const CANAL_SERVICO_DESATIVAR = 'servico:desativar'; // igual a canais.cjs → SERVICO_DESATIVAR
const CANAL_SERVICO_ARQUIVAR = 'servico:arquivar'; // igual a canais.cjs → SERVICO_ARQUIVAR
const CANAL_SERVICO_CONFIG = 'servico:config'; // igual a canais.cjs → SERVICO_CONFIG
const CANAL_CONTA_LISTAR = 'conta:listar'; // igual a canais.cjs → CONTA_LISTAR
const CANAL_CONTA_OBTER = 'conta:obter'; // igual a canais.cjs → CONTA_OBTER
const CANAL_CONTA_CRIAR = 'conta:criar'; // igual a canais.cjs → CONTA_CRIAR
const CANAL_CONTA_ATUALIZAR = 'conta:atualizar'; // igual a canais.cjs → CONTA_ATUALIZAR
const CANAL_CONTA_CANCELAR = 'conta:cancelar'; // igual a canais.cjs → CONTA_CANCELAR
const CANAL_CONTA_CONFIG = 'conta:config'; // igual a canais.cjs → CONTA_CONFIG
const CANAL_RECURRENCIA_LISTAR = 'recorrencia:listar'; // igual a canais.cjs → RECURRENCIA_LISTAR
const CANAL_RECURRENCIA_OBTER = 'recorrencia:obter'; // igual a canais.cjs → RECURRENCIA_OBTER
const CANAL_RECURRENCIA_CRIAR = 'recorrencia:criar'; // igual a canais.cjs → RECURRENCIA_CRIAR
const CANAL_RECURRENCIA_ATUALIZAR = 'recorrencia:atualizar'; // igual a canais.cjs → RECURRENCIA_ATUALIZAR
const CANAL_RECURRENCIA_ATIVAR = 'recorrencia:ativar'; // igual a canais.cjs → RECURRENCIA_ATIVAR
const CANAL_RECURRENCIA_DESATIVAR = 'recorrencia:desativar'; // igual a canais.cjs → RECURRENCIA_DESATIVAR
const CANAL_RECURRENCIA_ARQUIVAR = 'recorrencia:arquivar'; // igual a canais.cjs → RECURRENCIA_ARQUIVAR
const CANAL_RECURRENCIA_GERAR = 'recorrencia:gerar'; // igual a canais.cjs → RECURRENCIA_GERAR
const CANAL_RECURRENCIA_CONFIG = 'recorrencia:config'; // igual a canais.cjs → RECURRENCIA_CONFIG

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

    /**
     * Operações específicas de projetos (Fase 07) — nunca acesso genérico.
     */
    projeto: Object.freeze({
      criar: (dados) => ipcRenderer.invoke(CANAL_PROJETO_CRIAR, dados),
      listar: (jogadorId) => ipcRenderer.invoke(CANAL_PROJETO_LISTAR, { jogadorId }),
      obter: (id) => ipcRenderer.invoke(CANAL_PROJETO_OBTER, { id }),
      atualizar: (dados) => ipcRenderer.invoke(CANAL_PROJETO_ATUALIZAR, dados),
      iniciar: (id) => ipcRenderer.invoke(CANAL_PROJETO_INICIAR, { id }),
      concluir: (id) => ipcRenderer.invoke(CANAL_PROJETO_CONCLUIR, { id }),
      cancelar: (id) => ipcRenderer.invoke(CANAL_PROJETO_CANCELAR, { id }),
      arquivar: (id) => ipcRenderer.invoke(CANAL_PROJETO_ARQUIVAR, { id }),
      associarMissao: (projetoId, missaoId) =>
        ipcRenderer.invoke(CANAL_PROJETO_ASSOCIAR_MISSAO, { projetoId, missaoId }),
      removerMissao: (projetoId, missaoId) =>
        ipcRenderer.invoke(CANAL_PROJETO_REMOVER_MISSAO, { projetoId, missaoId }),
    }),

    /**
     * Operações específicas de finanças (Fase 08) — nunca acesso genérico.
     * Valores monetários trafegam em CENTAVOS (inteiros); a formatação em R$
     * acontece apenas na interface.
     */
    financa: Object.freeze({
      carteira: (jogadorId) => ipcRenderer.invoke(CANAL_FINANCA_CARTEIRA, { jogadorId }),
      saldo: (jogadorId, { inicio = null, fim = null } = {}) =>
        ipcRenderer.invoke(CANAL_FINANCA_SALDO, { jogadorId, inicio, fim }),
      resumo: (jogadorId, { inicio = null, fim = null } = {}) =>
        ipcRenderer.invoke(CANAL_FINANCA_RESUMO, { jogadorId, inicio, fim }),
      listarTransacoes: (jogadorId, { tipo = null, categoria = null, inicio = null, fim = null } = {}) =>
        ipcRenderer.invoke(CANAL_FINANCA_LISTAR_TRANSACOES, { jogadorId, tipo, categoria, inicio, fim }),
      criarTransacao: (dados) => ipcRenderer.invoke(CANAL_FINANCA_CRIAR_TRANSACAO, dados),
      atualizarTransacao: (dados) => ipcRenderer.invoke(CANAL_FINANCA_ATUALIZAR_TRANSACAO, dados),
      excluirTransacao: (id) => ipcRenderer.invoke(CANAL_FINANCA_EXCLUIR_TRANSACAO, { id }),
      listarOrcamentos: (jogadorId) => ipcRenderer.invoke(CANAL_FINANCA_LISTAR_ORCAMENTOS, { jogadorId }),
      criarOrcamento: (dados) => ipcRenderer.invoke(CANAL_FINANCA_CRIAR_ORCAMENTO, dados),
      atualizarOrcamento: (dados) => ipcRenderer.invoke(CANAL_FINANCA_ATUALIZAR_ORCAMENTO, dados),
      excluirOrcamento: (id) => ipcRenderer.invoke(CANAL_FINANCA_EXCLUIR_ORCAMENTO, { id }),
      situacaoOrcamento: (id) => ipcRenderer.invoke(CANAL_FINANCA_SITUACAO_ORCAMENTO, { id }),
    }),

    /**
     * Operacoes da Loja / Lista de Desejos (Fase 09).
     * Valores em CENTAVOS; a compra gera despesa via financas (Fase 08).
     */
    loja: Object.freeze({
      listar: (jogadorId, filtros = {}) =>
        ipcRenderer.invoke(CANAL_LOJA_LISTAR, { jogadorId, ...filtros }),
      obter: (id) => ipcRenderer.invoke(CANAL_LOJA_OBTER, { id }),
      criar: (dados) => ipcRenderer.invoke(CANAL_LOJA_CRIAR, dados),
      atualizar: (dados) => ipcRenderer.invoke(CANAL_LOJA_ATUALIZAR, dados),
      analisar: (id) => ipcRenderer.invoke(CANAL_LOJA_ANALISAR, { id }),
      planejar: (id) => ipcRenderer.invoke(CANAL_LOJA_PLANEJAR, { id }),
      comprar: (id, compra) => ipcRenderer.invoke(CANAL_LOJA_COMPRAR, { id, ...compra }),
      cancelar: (id) => ipcRenderer.invoke(CANAL_LOJA_CANCELAR, { id }),
      historico: (jogadorId) => ipcRenderer.invoke(CANAL_LOJA_HISTORICO, { jogadorId }),
      resumo: (jogadorId) => ipcRenderer.invoke(CANAL_LOJA_RESUMO, { jogadorId }),
      config: () => ipcRenderer.invoke(CANAL_LOJA_CONFIG),
    }),

    /**
     * Operacoes de Servicos (Fase 10.1).
     * Valores em CENTAVOS; o valor esperado e ESTIMATIVA — criar/editar/
     * arquivar um servico NAO cria transacao e NAO altera o saldo.
     */
    servico: Object.freeze({
      listar: (jogadorId, filtros = {}) =>
        ipcRenderer.invoke(CANAL_SERVICO_LISTAR, { jogadorId, ...filtros }),
      obter: (id) => ipcRenderer.invoke(CANAL_SERVICO_OBTER, { id }),
      criar: (dados) => ipcRenderer.invoke(CANAL_SERVICO_CRIAR, dados),
      atualizar: (dados) => ipcRenderer.invoke(CANAL_SERVICO_ATUALIZAR, dados),
      ativar: (id) => ipcRenderer.invoke(CANAL_SERVICO_ATIVAR, { id }),
      desativar: (id) => ipcRenderer.invoke(CANAL_SERVICO_DESATIVAR, { id }),
      arquivar: (id) => ipcRenderer.invoke(CANAL_SERVICO_ARQUIVAR, { id }),
      config: () => ipcRenderer.invoke(CANAL_SERVICO_CONFIG),
    }),

    /**
     * Operacoes de Contas / Despesas (Fase 10.2).
     * Valores em CENTAVOS. Uma conta e a OCORRENCIA de um servico:
     * criar/editar/cancelar NAO cria transacao e NAO altera o saldo.
     * `situacao` (pendente | vencida | cancelada) e DERIVADA do vencimento.
     */
    conta: Object.freeze({
      listar: (jogadorId, filtros = {}) =>
        ipcRenderer.invoke(CANAL_CONTA_LISTAR, { jogadorId, ...filtros }),
      obter: (id) => ipcRenderer.invoke(CANAL_CONTA_OBTER, { id }),
      criar: (dados) => ipcRenderer.invoke(CANAL_CONTA_CRIAR, dados),
      atualizar: (dados) => ipcRenderer.invoke(CANAL_CONTA_ATUALIZAR, dados),
      cancelar: (id) => ipcRenderer.invoke(CANAL_CONTA_CANCELAR, { id }),
      config: () => ipcRenderer.invoke(CANAL_CONTA_CONFIG),
    }),

    /**
     * Operacoes de Recorrencias (Fase 10.3) e GERACAO DE OCORRENCIAS
     * (Fase 10.4). A recorrencia e a REGRA DE REPETICAO de um servico:
     * criar/editar/ativar/desativar/arquivar NAO gera conta, NAO cria
     * transacao e NAO altera o saldo. `gerar` transforma a regra em contas
     * PENDENTES num periodo (idempotente — a mesma ocorrencia nao duplica),
     * mas NAO paga, NAO cria transacao e NAO altera saldo (Fase 10.5).
     */
    recorrencia: Object.freeze({
      listar: (jogadorId, filtros = {}) =>
        ipcRenderer.invoke(CANAL_RECURRENCIA_LISTAR, { jogadorId, ...filtros }),
      obter: (id) => ipcRenderer.invoke(CANAL_RECURRENCIA_OBTER, { id }),
      criar: (dados) => ipcRenderer.invoke(CANAL_RECURRENCIA_CRIAR, dados),
      atualizar: (dados) => ipcRenderer.invoke(CANAL_RECURRENCIA_ATUALIZAR, dados),
      ativar: (id) => ipcRenderer.invoke(CANAL_RECURRENCIA_ATIVAR, { id }),
      desativar: (id) => ipcRenderer.invoke(CANAL_RECURRENCIA_DESATIVAR, { id }),
      arquivar: (id) => ipcRenderer.invoke(CANAL_RECURRENCIA_ARQUIVAR, { id }),
      gerar: (id, periodo = {}) =>
        ipcRenderer.invoke(CANAL_RECURRENCIA_GERAR, { id, ...periodo }),
      config: () => ipcRenderer.invoke(CANAL_RECURRENCIA_CONFIG),
    }),
  }),
);
