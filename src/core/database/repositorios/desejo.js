/**
 * PULSO — Repositorio de Desejos (Fase 09 — Loja / Lista de Desejos)
 *
 * SQL exclusivo aqui, sem regras de negocio (maquina de estados e
 * comparacao de precos em src/core/dominio/loja.js).
 */

import { paraDesejo } from '../../dominio/loja.js';

const COLUNAS = [
  'id', 'jogador_id', 'titulo', 'descricao', 'categoria', 'prioridade',
  'estado', 'valor_esperado_centavos', 'valor_pago_centavos',
  'diferenca_centavos', 'data_compra', 'observacao_compra', 'transacao_id',
  'criado_em', 'atualizado_em', 'comprado_em',
].join(', ');

const INSERIR = `
  INSERT INTO desejo (jogador_id, titulo, descricao, categoria, prioridade, estado, valor_esperado_centavos)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const BUSCAR_POR_ID = `SELECT ${COLUNAS} FROM desejo WHERE id = ?`;

const LISTAR_BASE = `SELECT ${COLUNAS} FROM desejo`;

const ATUALIZAR_CAMPOS = `
  UPDATE desejo
  SET titulo = ?, descricao = ?, categoria = ?, prioridade = ?,
      valor_esperado_centavos = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

const ATUALIZAR_ESTADO = `
  UPDATE desejo
  SET estado = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

const REGISTRAR_COMPRA = `
  UPDATE desejo
  SET estado = 'comprado',
      valor_pago_centavos = ?,
      diferenca_centavos = ?,
      data_compra = ?,
      observacao_compra = ?,
      transacao_id = ?,
      comprado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

export class RepositorioDesejo {
  /** @param {import('node:sqlite').DatabaseSync} banco conexao ja inicializada */
  constructor(banco) {
    this._banco = banco;
    this._inserir = banco.prepare(INSERIR);
    this._porId = banco.prepare(BUSCAR_POR_ID);
    this._atualizarCampos = banco.prepare(ATUALIZAR_CAMPOS);
    this._atualizarEstado = banco.prepare(ATUALIZAR_ESTADO);
    this._registrarCompra = banco.prepare(REGISTRAR_COMPRA);
  }

  criar(jogadorId, dados, estado = 'desejado') {
    this._inserir.run(
      jogadorId,
      dados.titulo,
      dados.descricao,
      dados.categoria,
      dados.prioridade,
      estado,
      dados.precoEsperado,
    );
    const linha = this._banco.prepare('SELECT last_insert_rowid() AS id').get();
    return this.buscarPorId(linha.id);
  }

  buscarPorId(id) {
    return paraDesejo(this._porId.get(id));
  }

  listarPorJogador(jogadorId, { estado = null, categoria = null, prioridade = null } = {}) {
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
    if (prioridade) {
      condicoes.push('prioridade = ?');
      parametros.push(prioridade);
    }
    const sql = `${LISTAR_BASE} WHERE ${condicoes.join(' AND ')} ORDER BY criado_em DESC, id DESC`;
    return this._banco.prepare(sql).all(...parametros).map(paraDesejo);
  }

  listarComprados(jogadorId) {
    const sql = `${LISTAR_BASE} WHERE jogador_id = ? AND estado = 'comprado' ORDER BY data_compra DESC, id DESC`;
    return this._banco.prepare(sql).all(jogadorId).map(paraDesejo);
  }

  atualizar(id, dados) {
    this._atualizarCampos.run(
      dados.titulo,
      dados.descricao,
      dados.categoria,
      dados.prioridade,
      dados.precoEsperado,
      id,
    );
    return this.buscarPorId(id);
  }

  atualizarEstado(id, estado) {
    this._atualizarEstado.run(estado, id);
    return this.buscarPorId(id);
  }

  registrarCompra(id, { precoFinal, diferencaCentavos, data, observacao, transacaoId }) {
    this._registrarCompra.run(precoFinal, diferencaCentavos, data, observacao, transacaoId, id);
    return this.buscarPorId(id);
  }
}
