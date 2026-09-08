/**
 * PULSO — Serviço de Missões (Fase 05 — Missões)
 *
 * Orquestra as operações sobre missões: criação, consulta, transições
 * de estado e exclusão. Valida dados via domínio antes de persistir.
 *
 * Missões ainda NÃO concedem recompensas, XP nem alteram status — isso
 * fica para fases futuras (Fase 06 — Progressão).
 */

import {
  ESTADOS,
  PRIORIDADES,
  validarMissaoCriacao,
  validarMissaoEdicao,
  validarEstado,
  exigirTransicao,
  estadoTerminal,
  estaAtrasada,
  paraMissao,
} from '../dominio/missao.js';
import { ErroValidacao, ErroConflito, ErroTransicao } from '../erros.js';

export class ServicoMissao {
  /**
   * @param {{ repositorio: import('../database/repositorios/missao.js').RepositorioMissao }} deps
   */
  constructor({ repositorio }) {
    this._repositorio = repositorio;
  }

  /**
   * Cria uma nova missão para o jogador.
   * @param {number} jogadorId
   * @param {{ titulo: string, descricao?: string|null, prioridade?: string, prazo?: string|null }} dados
   * @returns {object} missão criada (estado PENDENTE)
   */
  criar(jogadorId, dados) {
    if (!jogadorId || typeof jogadorId !== 'number') {
      throw new ErroValidacao('Identificador do jogador inválido.');
    }
    const validados = validarMissaoCriacao(dados);
    return this._repositorio.criar(jogadorId, validados);
  }

  /** Busca uma missão pelo id. */
  obter(id) {
    const missao = this._repositorio.buscarPorId(id);
    if (!missao) {
      throw new ErroConflito(`Missão ${id} não encontrada.`);
    }
    return missao;
  }

  /** Lista todas as missões de um jogador (ordenadas). */
  listar(jogadorId) {
    return this._repositorio.listarPorJogador(jogadorId);
  }

  /**
   * Atualiza dados básicos da missão (título, descrição, prioridade, prazo).
   * Missões em estado terminal (concluída/cancelada) não podem ser editadas.
   * @param {number} id
   * @param {object} dados
   * @returns {object} missão atualizada
   */
  atualizar(id, dados) {
    const atual = this.obter(id);
    if (estadoTerminal(atual.estado)) {
      throw new ErroTransicao(
        `Não é possível editar uma missão ${atual.estado === ESTADOS.CONCLUIDA ? 'concluída' : 'cancelada'}.`,
      );
    }
    const validados = validarMissaoEdicao(dados);
    if (Object.keys(validados).length === 0) {
      throw new ErroValidacao('Nenhum campo válido para atualizar.');
    }
    return this._repositorio.atualizar(id, {
      titulo: validados.titulo ?? atual.titulo,
      descricao: validados.descricao ?? atual.descricao,
      estado: atual.estado,
      prioridade: validados.prioridade ?? atual.prioridade,
      prazo: validados.prazo ?? atual.prazo,
      iniciadaEm: atual.iniciadaEm,
      concluidaEm: atual.concluidaEm,
      canceladaEm: atual.canceladaEm,
    });
  }

  /**
   * Inicia uma missão (PENDENTE → EM_ANDAMENTO).
   * @param {number} id
   * @returns {object} missão atualizada
   */
  iniciar(id) {
    const atual = this.obter(id);
    exigirTransicao(atual.estado, ESTADOS.EM_ANDAMENTO);
    const agora = new Date().toISOString();
    return this._repositorio.atualizar(id, {
      titulo: atual.titulo,
      descricao: atual.descricao,
      estado: ESTADOS.EM_ANDAMENTO,
      prioridade: atual.prioridade,
      prazo: atual.prazo,
      iniciadaEm: agora,
      concluidaEm: null,
      canceladaEm: null,
    });
  }

  /**
   * Conclui uma missão (EM_ANDAMENTO → CONCLUÍDA).
   * @param {number} id
   * @returns {object} missão atualizada
   */
  concluir(id) {
    const atual = this.obter(id);
    exigirTransicao(atual.estado, ESTADOS.CONCLUIDA);
    const agora = new Date().toISOString();
    return this._repositorio.atualizar(id, {
      titulo: atual.titulo,
      descricao: atual.descricao,
      estado: ESTADOS.CONCLUIDA,
      prioridade: atual.prioridade,
      prazo: atual.prazo,
      iniciadaEm: atual.iniciadaEm,
      concluidaEm: agora,
      canceladaEm: null,
    });
  }

  /**
   * Cancela uma missão (PENDENTE/EM_ANDAMENTO → CANCELADA).
   * @param {number} id
   * @returns {object} missão atualizada
   */
  cancelar(id) {
    const atual = this.obter(id);
    exigirTransicao(atual.estado, ESTADOS.CANCELADA);
    const agora = new Date().toISOString();
    return this._repositorio.atualizar(id, {
      titulo: atual.titulo,
      descricao: atual.descricao,
      estado: ESTADOS.CANCELADA,
      prioridade: atual.prioridade,
      prazo: atual.prazo,
      iniciadaEm: atual.iniciadaEm,
      concluidaEm: null,
      canceladaEm: agora,
    });
  }

  /**
   * Exclui uma missão, se permitido pela regra:
   * - pendente: pode excluir;
   * - em andamento: pode excluir (com confirmação na interface);
   * - concluída/cancelada: NÃO pode (preserva histórico).
   * @param {number} id
   */
  excluir(id) {
    const atual = this.obter(id);
    if (estadoTerminal(atual.estado)) {
      throw new ErroTransicao(
        `Não é possível excluir uma missão ${atual.estado === ESTADOS.CONCLUIDA ? 'concluída' : 'cancelada'}.`,
      );
    }
    this._repositorio.excluir(id);
  }

  /**
   * Verifica se uma missão está atrasada (prazo passado e não terminal).
   * @param {object} missao
   * @returns {boolean}
   */
  static atrasada(missao) {
    return estaAtrasada(missao.prazo, missao.estado);
  }
}
