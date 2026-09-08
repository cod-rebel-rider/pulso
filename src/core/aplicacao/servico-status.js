/**
 * PULSO — Aplicação: serviço de Status (Fase 04 — Sistema de Status)
 *
 * Orquestra criação, consulta e alteração do estado do jogador, aplicando
 * as regras do domínio antes de persistir. O renderer alcança esta camada
 * apenas via IPC — nunca o banco diretamente.
 *
 * Regras de produto (docs/status.md):
 * - estado inicial criado automaticamente junto com o jogador (transação);
 * - jogador antigo SEM status (banco vindo de versão anterior) é
 *   inicializado de forma segura, sem duplicar;
 * - cada jogador tem UM único estado atual (histórico = fase futura).
 */

import {
  STATUS_DISPONIVEIS,
  VALORES_INICIAIS,
  validarNomeStatus,
  validarDelta,
  calcularNovoValor,
} from '../dominio/status.js';
import { ErroConflito } from '../erros.js';

export class ServicoStatus {
  /**
   * @param {{ repositorio: object, repositorioJogador: object }} dependências
   */
  constructor({ repositorio, repositorioJogador }) {
    this._repositorio = repositorio;
    this._repositorioJogador = repositorioJogador;
  }

  _garantirJogadorValido(jogadorId) {
    if (!this._repositorioJogador.buscarPorId(jogadorId)) {
      throw new ErroConflito('Jogador não encontrado.');
    }
  }

  /**
   * Cria o estado inicial do jogador (chamado dentro da transação de criação
   * do jogador). Idempotente: se já existir, devolve o existente.
   * @param {number} jogadorId
   * @returns {object} status
   */
  criarInicial(jogadorId) {
    if (this._repositorio.existe(jogadorId)) {
      return this._repositorio.buscarPorJogador(jogadorId);
    }
    return this._repositorio.criar(jogadorId, VALORES_INICIAIS);
  }

  /**
   * Obtém o status atual; inicializa caso o jogador não tenha (migração de
   * banco antigo) — nunca cria duplicata.
   * @param {number} jogadorId
   * @returns {object} status
   */
  obter(jogadorId) {
    this._garantirJogadorValido(jogadorId);
    const status = this._repositorio.buscarPorJogador(jogadorId);
    if (status) return status;
    return this.criarInicial(jogadorId);
  }

  /**
   * Altera um status (ex.: energia -10), limitado a 0–100 pelo domínio.
   * @param {number} jogadorId
   * @param {string} nomeStatus 'energia' | 'foco' | 'estresse' | 'criatividade'
   * @param {number} delta alteração (pode ser negativa ou positiva)
   * @returns {object} status atualizado
   * @throws {ErroValidacao} status desconhecido ou delta inválido
   */
  alterar(jogadorId, nomeStatus, delta) {
    this._garantirJogadorValido(jogadorId);
    validarNomeStatus(nomeStatus);
    validarDelta(delta);
    const atual = this.obter(jogadorId);

    const novosValores = {};
    for (const nome of STATUS_DISPONIVEIS) {
      novosValores[nome] =
        nome === nomeStatus ? calcularNovoValor(nome, atual[nome], delta) : atual[nome];
    }

    return this._repositorio.atualizar(jogadorId, novosValores);
  }
}