/**
 * PULSO — Serviço de Progressão (Fase 06 — Progressão)
 *
 * Orquestra as operações de XP, nível e atributos.
 * Coordena o repositório e as regras de domínio.
 */

import {
  ATRIBUTOS,
  calcularLevelUp,
  calcularProgresso,
  criarAtributosIniciais,
  PONTOS_POR_NIVEL,
  validarNomeAtributo,
  validarQuantidadePontos,
  validarXp,
} from '../dominio/progressao.js';
import { ErroValidacao, ErroConflito } from '../erros.js';

export class ServicoProgressao {
  /**
   * @param {object} deps
   * @param {import('../database/repositorios/progressao.js').RepositorioProgressao} deps.repositorio
   */
  constructor({ repositorio }) {
    this._repositorio = repositorio;
  }

    /**
   * Garante que o jogador possui progressão e atributos inicializados.
   * Idempotente: não duplica se já existir.
   * @param {number} jogadorId
   * @returns {{ progressao: object, atributos: object }} estado inicial
   */
  inicializar(jogadorId) {
    if (!this._repositorio.progressaoExiste(jogadorId)) {
      this._repositorio.criarProgressao(jogadorId);
    }
    if (!this._repositorio.atributosExiste(jogadorId)) {
      this._repositorio.criarAtributos(jogadorId);
    }
    const progressao = this._repositorio.buscarProgressao(jogadorId);
    const atributos = this._repositorio.buscarAtributos(jogadorId);
    return { progressao, atributos };
  }

  /**
   * Retorna o estado completo da progressão (XP, nível, progresso, atributos).
   * @param {number} jogadorId
   * @returns {{ progressao: object, progresso: object, atributos: object }}
   */
  obter(jogadorId) {
    this.inicializar(jogadorId);
    const progressao = this._repositorio.buscarProgressao(jogadorId);
    const atributos = this._repositorio.buscarAtributos(jogadorId);
    const progresso = calcularProgresso(progressao.xpTotal);
    return { progressao, progresso, atributos };
  }

  /**
   * Adiciona XP ao jogador. Processa level up e concede pontos.
   * @param {number} jogadorId
   * @param {number} quantidade XP a adicionar (positivo)
   * @returns {{ progressao: object, progresso: object, nivelou: boolean, niveisGanhos: number }}
   */
  adicionarXp(jogadorId, quantidade) {
    validarXp(quantidade);
    this.inicializar(jogadorId);

    const progressao = this._repositorio.buscarProgressao(jogadorId);
    const { niveisGanhos } = calcularLevelUp(progressao.xpTotal, quantidade);

    const novoXp = progressao.xpTotal + quantidade;
    const novosPontos = progressao.pontosDisponiveis + niveisGanhos * PONTOS_POR_NIVEL;

    const atualizada = this._repositorio.atualizarProgressao(jogadorId, {
      xpTotal: novoXp,
      pontosDisponiveis: novosPontos,
    });
    const progresso = calcularProgresso(novoXp);

    return {
      progressao: atualizada,
      progresso,
      nivelou: niveisGanhos > 0,
      niveisGanhos,
    };
  }

  /**
   * Distribui pontos em um atributo.
   * @param {number} jogadorId
   * @param {string} atributo nome do atributo
   * @param {number} quantidade pontos a adicionar (positivo)
   * @returns {{ atributos: object, progressao: object }}
   */
  aumentarAtributo(jogadorId, atributo, quantidade) {
    validarNomeAtributo(atributo);
    validarQuantidadePontos(quantidade);
    this.inicializar(jogadorId);

    const progressao = this._repositorio.buscarProgressao(jogadorId);
    if (progressao.pontosDisponiveis < quantidade) {
      throw new ErroValidacao(
        `Pontos insuficientes: disponíveis ${progressao.pontosDisponiveis}, solicitados ${quantidade}.`,
      );
    }

    const atributos = this._repositorio.buscarAtributos(jogadorId);
    const valorAtual = atributos[atributo];
    const novoValor = valorAtual + quantidade;

    if (novoValor > 100) {
      throw new ErroValidacao(
        `Atributo ${atributo} não pode ultrapassar 100 (atual: ${valorAtual}, adicionando: ${quantidade}).`,
      );
    }

    const atributosAtualizados = this._repositorio.atualizarAtributo(jogadorId, atributo, novoValor);
    const progressaoAtualizada = this._repositorio.atualizarProgressao(jogadorId, {
      xpTotal: progressao.xpTotal,
      pontosDisponiveis: progressao.pontosDisponiveis - quantidade,
    });

    return { atributos: atributosAtualizados, progressao: progressaoAtualizada };
  }
}
