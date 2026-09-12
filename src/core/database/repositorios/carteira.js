/**
 * PULSO — Repositório de Carteira (Fase 08 — Finanças)
 *
 * Segue o padrão dos demais repositórios: SQL somente aqui, statements
 * preparados no construtor, sem regras de negócio (domínio em
 * src/core/dominio/financa.js).
 */

import { paraCarteira } from '../../dominio/financa.js';

const INSERIR = `
  INSERT INTO carteira (jogador_id, nome, moeda)
  VALUES (?, ?, ?)
`;
const BUSCAR_POR_ID = `
  SELECT id, jogador_id, nome, moeda, criado_em, atualizado_em
  FROM carteira WHERE id = ?
`;
const BUSCAR_POR_JOGADOR = `
  SELECT id, jogador_id, nome, moeda, criado_em, atualizado_em
  FROM carteira WHERE jogador_id = ? ORDER BY id LIMIT 1
`;

export class RepositorioCarteira {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._banco = banco;
    this._inserir = banco.prepare(INSERIR);
    this._porId = banco.prepare(BUSCAR_POR_ID);
    this._porJogador = banco.prepare(BUSCAR_POR_JOGADOR);
  }

  /** Cria uma carteira (dados já validados pelo domínio/serviço). */
  criar(jogadorId, { nome, moeda }) {
    const resultado = this._inserir.run(jogadorId, nome, moeda);
    return this.buscarPorId(Number(resultado.lastInsertRowid));
  }

  /** Carteira pelo identificador ou null. */
  buscarPorId(id) {
    return paraCarteira(this._porId.get(id));
  }

  /** Primeira carteira do jogador (carteira principal nesta fase) ou null. */
  buscarPorJogador(jogadorId) {
    return paraCarteira(this._porJogador.get(jogadorId));
  }
}