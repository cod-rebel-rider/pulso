/**
 * PULSO — Repositório de Serviços (Fase 10.1 — Estrutura de Serviços)
 *
 * SQL exclusivo aqui, sem regras de negócio (ciclo de vida e validações
 * em src/core/dominio/servico.js). Valores em centavos (inteiro).
 */

import { paraServico } from '../../dominio/servico.js';

const COLUNAS = [
  'id', 'jogador_id', 'nome', 'descricao', 'fornecedor', 'categoria',
  'valor_esperado_centavos', 'estado', 'criado_em', 'atualizado_em', 'arquivado_em',
].join(', ');

const INSERIR = `
  INSERT INTO servico (jogador_id, nome, descricao, fornecedor, categoria, valor_esperado_centavos, estado)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const BUSCAR_POR_ID = `SELECT ${COLUNAS} FROM servico WHERE id = ?`;

const LISTAR_BASE = `SELECT ${COLUNAS} FROM servico`;

const ATUALIZAR_CAMPOS = `
  UPDATE servico
  SET nome = ?, descricao = ?, fornecedor = ?, categoria = ?,
      valor_esperado_centavos = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

const ATUALIZAR_ESTADO = `
  UPDATE servico
  SET estado = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

const ARQUIVAR = `
  UPDATE servico
  SET estado = 'arquivado',
      arquivado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

export class RepositorioServico {
  /** @param {import('node:sqlite').DatabaseSync} banco conexao ja inicializada */
  constructor(banco) {
    this._banco = banco;
    this._inserir = banco.prepare(INSERIR);
    this._porId = banco.prepare(BUSCAR_POR_ID);
    this._atualizarCampos = banco.prepare(ATUALIZAR_CAMPOS);
    this._atualizarEstado = banco.prepare(ATUALIZAR_ESTADO);
    this._arquivar = banco.prepare(ARQUIVAR);
  }

  criar(jogadorId, dados, estado = 'ativo') {
    this._inserir.run(
      jogadorId,
      dados.nome,
      dados.descricao,
      dados.fornecedor,
      dados.categoria,
      dados.valorEsperado,
      estado,
    );
    const linha = this._banco.prepare('SELECT last_insert_rowid() AS id').get();
    return this.buscarPorId(linha.id);
  }

  buscarPorId(id) {
    return paraServico(this._porId.get(id));
  }

  listarPorJogador(jogadorId, { estado = null, categoria = null } = {}) {
    const condicoes = ['jogador_id = ?'];
    const parametros = [jogadorId];
    if (estado) {
      condicoes.push('estado = ?');
      parametros.push(estado);
    }
    if (categoria) {
      condicoes.push('categoria = ?');
      parametros.push(categoria);
    }
    const sql = `${LISTAR_BASE} WHERE ${condicoes.join(' AND ')} ORDER BY criado_em DESC, id DESC`;
    return this._banco.prepare(sql).all(...parametros).map(paraServico);
  }

  atualizar(id, dados) {
    this._atualizarCampos.run(
      dados.nome,
      dados.descricao,
      dados.fornecedor,
      dados.categoria,
      dados.valorEsperado,
      id,
    );
    return this.buscarPorId(id);
  }

  atualizarEstado(id, estado) {
    this._atualizarEstado.run(estado, id);
    return this.buscarPorId(id);
  }

  arquivar(id) {
    this._arquivar.run(id);
    return this.buscarPorId(id);
  }
}
