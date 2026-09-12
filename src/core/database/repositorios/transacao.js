/**
 * PULSO — Repositório de Transações (Fase 08 — Finanças)
 *
 * SQL exclusivo aqui, sem regras de negócio (validação e cálculo de saldo
 * em src/core/dominio/financa.js). A ordenação do histórico é controlada
 * pela consulta (ocorrida_em DESC, id DESC) — nunca pela ordem de inserção.
 */

import { paraTransacao } from '../../dominio/financa.js';

const COLUNAS = 'id, carteira_id, tipo, valor_centavos, categoria, descricao, ocorrida_em, criado_em, atualizado_em';
const INSERIR = `
  INSERT INTO transacao (carteira_id, tipo, valor_centavos, categoria, descricao, ocorrida_em)
  VALUES (?, ?, ?, ?, ?, ?)
`;
const BUSCAR_POR_ID = `SELECT ${COLUNAS} FROM transacao WHERE id = ?`;
const LISTAR_BASE = `SELECT ${COLUNAS} FROM transacao`;
const ATUALIZAR = `
  UPDATE transacao
  SET tipo = ?, valor_centavos = ?, categoria = ?, descricao = ?, ocorrida_em = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;
const EXCLUIR = 'DELETE FROM transacao WHERE id = ?';

export class RepositorioTransacao {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._banco = banco;
    this._inserir = banco.prepare(INSERIR);
    this._porId = banco.prepare(BUSCAR_POR_ID);
    this._atualizar = banco.prepare(ATUALIZAR);
    this._excluir = banco.prepare(EXCLUIR);
  }

  /** Cria uma transação (dados já validados pelo domínio/serviço). */
  criar(carteiraId, dados) {
    const resultado = this._inserir.run(
      carteiraId,
      dados.tipo,
      dados.valorCentavos,
      dados.categoria,
      dados.descricao,
      dados.ocorridaEm,
    );
    return this.buscarPorId(Number(resultado.lastInsertRowid));
  }

  /** Transação pelo id ou null. */
  buscarPorId(id) {
    return paraTransacao(this._porId.get(id));
  }

  /**
   * Transações da carteira, mais recentes primeiro. Filtros opcionais:
   * tipo, categoria e período (inclusive, 'YYYY-MM-DD').
   */
  listarPorCarteira(
    carteiraId,
    { tipo = null, categoria = null, inicio = null, fim = null } = {},
  ) {
    const condicoes = ['carteira_id = ?'];
    const parametros = [carteiraId];
    if (tipo) {
      condicoes.push('tipo = ?');
      parametros.push(tipo);
    }
    if (categoria) {
      condicoes.push('categoria = ?');
      parametros.push(categoria);
    }
    if (inicio) {
      condicoes.push('ocorrida_em >= ?');
      parametros.push(inicio);
    }
    if (fim) {
      condicoes.push('ocorrida_em <= ?');
      parametros.push(fim);
    }
    const sql = `${LISTAR_BASE} WHERE ${condicoes.join(' AND ')} ORDER BY ocorrida_em DESC, id DESC`;
    return this._banco.prepare(sql).all(...parametros).map(paraTransacao);
  }

  /** Atualiza uma transação existente (dados completos já resolvidos). */
  atualizar(id, dados) {
    this._atualizar.run(
      dados.tipo,
      dados.valorCentavos,
      dados.categoria,
      dados.descricao,
      dados.ocorridaEm,
      id,
    );
    return this.buscarPorId(id);
  }

  /** Exclusão física controlada (interface pede confirmação antes). */
  excluir(id) {
    this._excluir.run(id);
  }
}