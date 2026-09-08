/**
 * PULSO — Repositório de Status (Fase 04 — Sistema de Status)
 *
 * Segue o padrão dos demais repositórios: SQL somente aqui, statements
 * preparados no construtor, métodos com nomes de intenção, sem regras de
 * negócio (validação/limites ficam em src/core/dominio/status.js).
 */

const INSERIR = `
  INSERT INTO jogador_status (jogador_id, energia, foco, estresse, criatividade)
  VALUES (?, ?, ?, ?, ?)
`;
const BUSCAR_POR_JOGADOR = `
  SELECT id, jogador_id, energia, foco, estresse, criatividade, criado_em, atualizado_em
  FROM jogador_status
  WHERE jogador_id = ?
`;
const ATUALIZAR = `
  UPDATE jogador_status
  SET energia = ?, foco = ?, estresse = ?, criatividade = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE jogador_id = ?
`;
const CONTAR_POR_JOGADOR = 'SELECT COUNT(*) AS total FROM jogador_status WHERE jogador_id = ?';

/** Converte a linha do banco em objeto de status (camelCase, congelado). */
function paraStatus(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    energia: linha.energia,
    foco: linha.foco,
    estresse: linha.estresse,
    criatividade: linha.criatividade,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  });
}

export class RepositorioStatus {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._inserir = banco.prepare(INSERIR);
    this._buscarPorJogador = banco.prepare(BUSCAR_POR_JOGADOR);
    this._atualizar = banco.prepare(ATUALIZAR);
    this._contar = banco.prepare(CONTAR_POR_JOGADOR);
  }

  /**
   * Cria o registro de status (valores já validados/limitados pelo domínio).
   * @param {number} jogadorId
   * @param {{ energia: number, foco: number, estresse: number, criatividade: number }} valores
   * @returns {object} status criado
   */
  criar(jogadorId, valores) {
    this._inserir.run(jogadorId, valores.energia, valores.foco, valores.estresse, valores.criatividade);
    return this.buscarPorJogador(jogadorId);
  }

  /** Status atual do jogador ou null. */
  buscarPorJogador(jogadorId) {
    return paraStatus(this._buscarPorJogador.get(jogadorId));
  }

  /**
   * Atualiza os valores e o carimbo `atualizado_em`.
   * @param {number} jogadorId
   * @param {{ energia: number, foco: number, estresse: number, criatividade: number }} valores
   * @returns {object|null} status atualizado
   */
  atualizar(jogadorId, valores) {
    this._atualizar.run(valores.energia, valores.foco, valores.estresse, valores.criatividade, jogadorId);
    return this.buscarPorJogador(jogadorId);
  }

  /** Existe registro de status para o jogador? */
  existe(jogadorId) {
    return this._contar.get(jogadorId).total > 0;
  }
}