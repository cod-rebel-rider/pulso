/**
 * PULSO — Aplicação: serviço do Jogador (Fase 03 — Jogador)
 *
 * Coordena criação, consulta e atualização do jogador, aplicando as regras
 * do domínio antes de qualquer persistência. É a única porta usada pela
 * camada de IPC — o renderer nunca alcança o repositório diretamente.
 *
 * Decisão de produto (docs/jogador.md): aplicação SINGLE-PLAYER — o serviço
 * impõe no máximo um jogador. O schema permanece aberto a evolução futura.
 */

import { validarIdentidade } from '../dominio/jogador.js';
import { comTransacao } from '../database/transacao.js';
import { ErroConflito } from '../erros.js';

export class ServicoJogador {
  /**
   * @param {{
   *   repositorio: object,
   *   banco?: import('node:sqlite').DatabaseSync,
   *   aoCriar?: (jogador: object) => void
   * }} dependências `banco` + `aoCriar` permitem criar o jogador e o status
   * inicial de forma atômica (Fase 04).
   */
  constructor({ repositorio, banco = null, aoCriar = null }) {
    this._repositorio = repositorio;
    this._banco = banco;
    this._aoCriar = aoCriar;
  }

  /** Responde "existe um jogador configurado?". */
  existe() {
    return this._repositorio.existe();
  }

  /** Jogador atual ou null (primeiro acesso). */
  obter() {
    return this._repositorio.buscarPrimeiro();
  }

  /**
   * Cria o jogador com a identidade validada.
   * @param {{ nome?: unknown, codinome?: unknown }} dados
   * @returns {object} jogador criado
   * @throws {ErroConflito} quando já existe jogador (aplicação single-player)
   * @throws {ErroValidacao} quando a identidade é inválida
   */
  criar(dados) {
    if (this._repositorio.existe()) {
      throw new ErroConflito('Já existe um jogador configurado neste sistema.');
    }
    const identidade = validarIdentidade(dados);
    const criar = () => {
      const jogador = this._repositorio.criar(identidade);
      if (this._aoCriar) this._aoCriar(jogador); // ex.: status inicial (Fase 04)
      return jogador;
    };
    // Com banco disponível, jogador + status inicial são atômicos.
    return this._banco ? comTransacao(this._banco, criar) : criar();
  }

  /**
   * Atualiza a identidade de um jogador existente.
   * @param {number} id identificador interno
   * @param {{ nome?: unknown, codinome?: unknown }} dados
   * @returns {object} jogador atualizado
   * @throws {ErroConflito} quando o jogador não existe
   * @throws {ErroValidacao} quando a identidade é inválida
   */
  atualizar(id, dados) {
    const atual = this._repositorio.buscarPorId(id);
    if (!atual) {
      throw new ErroConflito('Jogador não encontrado para atualização.');
    }
    const identidade = validarIdentidade(dados);
    return this._repositorio.atualizar(id, identidade);
  }
}
