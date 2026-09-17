/**
 * PULSO — Repositório de Recorrências (Fase 10.3)
 *
 * SQL exclusivo aqui, sem regras de negócio (validações e ciclo de vida
 * vivem em src/core/dominio/recorrencia.js). Valores em centavos.
 *
 * Importante: nenhuma operação aqui cria contas, transações ou toca em
 * carteira/saldo — a recorrência é apenas a regra (geração é da Fase 10.4).
 */

import { paraRecorrencia } from '../../dominio/recorrencia.js';

const COLUNAS = [
  'id', 'jogador_id', 'servico_id', 'frequencia', 'data_inicio', 'data_fim',
  'dia_vencimento', 'valor_esperado_centavos', 'descricao', 'estado',
  'criado_em', 'atualizado_em', 'arquivado_em',
].join(', ');

const INSERIR = `
  INSERT INTO servico_recorrencia
    (jogador_id, servico_id, frequencia, data_inicio, data_fim, dia_vencimento,
     valor_esperado_centavos, descricao, estado)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const BUSCAR_POR_ID = `SELECT ${COLUNAS} FROM servico_recorrencia WHERE id = ?`;

const LISTAR_BASE = `SELECT ${COLUNAS} FROM servico_recorrencia`;

const ATUALIZAR_CAMPOS = `
  UPDATE servico_recorrencia
  SET frequencia = ?, data_inicio = ?, data_fim = ?, dia_vencimento = ?,
      valor_esperado_centavos = ?, descricao = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

const ATUALIZAR_ESTADO = `
  UPDATE servico_recorrencia
  SET estado = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

const ARQUIVAR = `
  UPDATE servico_recorrencia
  SET estado = 'arquivada',
      arquivado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

export class RepositorioRecorrencia {
  /** @param {import('node:sqlite').DatabaseSync} banco conexao ja inicializada */
  constructor(banco) {
    this._banco = banco;
    this._inserir = banco.prepare(INSERIR);
    this._porId = banco.prepare(BUSCAR_POR_ID);
    this._atualizarCampos = banco.prepare(ATUALIZAR_CAMPOS);
    this._atualizarEstado = banco.prepare(ATUALIZAR_ESTADO);
    this._arquivar = banco.prepare(ARQUIVAR);
  }

  criar(jogadorId, dados, estado = 'ativa') {
    this._inserir.run(
      jogadorId,
      dados.servicoId,
      dados.frequencia,
      dados.dataInicio,
      dados.dataFim,
      dados.diaVencimento,
      dados.valorEsperado,
      dados.descricao,
      estado,
    );
    const linha = this._banco.prepare('SELECT last_insert_rowid() AS id').get();
    return this.buscarPorId(linha.id);
  }

  buscarPorId(id) {
    return paraRecorrencia(this._porId.get(id));
  }

  listarPorJogador(jogadorId, { servicoId = null, estado = null } = {}) {
    const condicoes = ['jogador_id = ?'];
    const parametros = [jogadorId];
    if (servicoId) {
      condicoes.push('servico_id = ?');
      parametros.push(servicoId);
    }
    if (estado) {
      condicoes.push('estado = ?');
      parametros.push(estado);
    }
    const sql = `${LISTAR_BASE} WHERE ${condicoes.join(' AND ')} ORDER BY data_inicio ASC, id ASC`;
    return this._banco.prepare(sql).all(...parametros).map(paraRecorrencia);
  }

  atualizar(id, dados) {
    this._atualizarCampos.run(
      dados.frequencia,
      dados.dataInicio,
      dados.dataFim,
      dados.diaVencimento,
      dados.valorEsperado,
      dados.descricao,
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