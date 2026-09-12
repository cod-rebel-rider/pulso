/**
 * PULSO — Repositório de Orçamentos (Fase 08 — Finanças)
 *
 * Segue o padrão dos demais repositórios: SQL somente aqui, sem regras de
 * negócio (categorias, períodos e situação do orçamento em
 * src/core/dominio/financa.js).
 */

import { paraOrcamento } from '../../dominio/financa.js';

const COLUNAS = 'id, jogador_id, categoria, nome, valor_centavos, inicio, fim, criado_em, atualizado_em';
const INSERIR = `
  INSERT INTO orcamento (jogador_id, categoria, nome, valor_centavos, inicio, fim)
  VALUES (?, ?, ?, ?, ?, ?)
`;
const BUSCAR_POR_ID = `SELECT ${COLUNAS} FROM orcamento WHERE id = ?`;
const LISTAR_POR_JOGADOR = `
  SELECT ${COLUNAS} FROM orcamento
  WHERE jogador_id = ? ORDER BY inicio ASC, fim ASC, id ASC
`;
const ATUALIZAR = `
  UPDATE orcamento
  SET categoria = ?, nome = ?, valor_centavos = ?, inicio = ?, fim = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;
const EXCLUIR = 'DELETE FROM orcamento WHERE id = ?';

export class RepositorioOrcamento {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._banco = banco;
    this._inserir = banco.prepare(INSERIR);
    this._porId = banco.prepare(BUSCAR_POR_ID);
    this._listar = banco.prepare(LISTAR_POR_JOGADOR);
    this._atualizar = banco.prepare(ATUALIZAR);
    this._excluir = banco.prepare(EXCLUIR);
  }

  /** Cria um orçamento (dados já validados pelo domínio/serviço). */
  criar(jogadorId, dados) {
    const resultado = this._inserir.run(
      jogadorId,
      dados.categoria,
      dados.nome,
      dados.valorCentavos,
      dados.inicio,
      dados.fim,
    );
    return this.buscarPorId(Number(resultado.lastInsertRowid));
  }

  /** Orçamento pelo id ou null. */
  buscarPorId(id) {
    return paraOrcamento(this._porId.get(id));
  }

  /** Todos os orçamentos de um jogador (ordenados por período). */
  listarPorJogador(jogadorId) {
    return this._listar.all(jogadorId).map(paraOrcamento);
  }

  /** Atualiza um orçamento existente (dados completos já resolvidos). */
  atualizar(id, dados) {
    this._atualizar.run(
      dados.categoria,
      dados.nome,
      dados.valorCentavos,
      dados.inicio,
      dados.fim,
      id,
    );
    return this.buscarPorId(id);
  }

  /** Exclusão física controlada (interface pede confirmação antes). */
  excluir(id) {
    this._excluir.run(id);
  }
}