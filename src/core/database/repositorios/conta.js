/**
 * PULSO — Repositório de Contas / Despesas (Fase 10.2; vínculo 10.4)
 *
 * SQL exclusivo aqui, sem regras de negócio (validações e derivação da
 * situação vivem em src/core/dominio/conta.js). Valores em centavos.
 *
 * Importante: cancelar uma conta apenas grava `estado`/`cancelado_em` —
 * NÃO cria transação e NÃO toca em carteira/saldo. A listagem por
 * "vencida" NÃO é feita aqui (é condição derivada, ver domínio).
 * Desde a Fase 10.4, `recorrencia_id` registra a recorrência que gerou a
 * conta (nulo nas contas manuais) — somente leitura: edição e cancelamento
 * nunca alteram o vínculo.
 */

import { paraConta } from '../../dominio/conta.js';

const COLUNAS = [
  'id', 'jogador_id', 'servico_id', 'referencia', 'descricao',
  'valor_esperado_centavos', 'vencimento', 'estado',
  'criado_em', 'atualizado_em', 'cancelado_em', 'recorrencia_id',
].join(', ');

const INSERIR = `
  INSERT INTO servico_conta
    (jogador_id, servico_id, referencia, descricao, valor_esperado_centavos,
     vencimento, estado, recorrencia_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

const BUSCAR_POR_ID = `SELECT ${COLUNAS} FROM servico_conta WHERE id = ?`;

const BUSCAR_POR_SERVICO_REFERENCIA = `
  SELECT ${COLUNAS}
  FROM servico_conta
  WHERE servico_id = ? AND referencia = ?
`;

const LISTAR_BASE = `SELECT ${COLUNAS} FROM servico_conta`;

const ATUALIZAR_CAMPOS = `
  UPDATE servico_conta
  SET referencia = ?, descricao = ?, valor_esperado_centavos = ?, vencimento = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

const CANCELAR = `
  UPDATE servico_conta
  SET estado = 'cancelada',
      cancelado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

const MARCAR_COMO_PAGA = `
  UPDATE servico_conta
  SET estado = 'paga',
      paid_amount = ?,
      paid_at = ?,
      payment_description = ?,
      transaction_id = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

export class RepositorioConta {
  /** @param {import('node:sqlite').DatabaseSync} banco conexao ja inicializada */
  constructor(banco) {
    this._banco = banco;
    this._inserir = banco.prepare(INSERIR);
    this._porId = banco.prepare(BUSCAR_POR_ID);
    this._porServicoReferencia = banco.prepare(BUSCAR_POR_SERVICO_REFERENCIA);
    this._atualizarCampos = banco.prepare(ATUALIZAR_CAMPOS);
    this._cancelar = banco.prepare(CANCELAR);
    this._marcarComoPaga = banco.prepare(MARCAR_COMO_PAGA);
  }

  criar(jogadorId, dados, estado = 'pendente') {
    this._inserir.run(
      jogadorId,
      dados.servicoId,
      dados.referencia,
      dados.descricao,
      dados.valorEsperado,
      dados.vencimento,
      estado,
      dados.recorrenciaId ?? null,
    );
    const linha = this._banco.prepare('SELECT last_insert_rowid() AS id').get();
    return this.buscarPorId(linha.id);
  }

  buscarPorId(id) {
    return paraConta(this._porId.get(id));
  }

  /** Usado para impedir duplicar a MESMA ocorrência do mesmo serviço. */
  buscarPorServicoEReferencia(servicoId, referencia) {
    return paraConta(this._porServicoReferencia.get(servicoId, referencia));
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
    const sql = `${LISTAR_BASE} WHERE ${condicoes.join(' AND ')} ORDER BY vencimento ASC, id ASC`;
    return this._banco.prepare(sql).all(...parametros).map(paraConta);
  }

  atualizar(id, dados) {
    this._atualizarCampos.run(
      dados.referencia,
      dados.descricao,
      dados.valorEsperado,
      dados.vencimento,
      id,
    );
    return this.buscarPorId(id);
  }

  cancelar(id) {
    this._cancelar.run(id);
    return this.buscarPorId(id);
  }

  /**
   * Marca a conta como paga (FASE 10.5). Preenche paid_amount, paid_at,
   * payment_description e transaction_id. Deve ser chamado dentro de uma
   * transação que também cria a transação financeira correspondente.
   */
  marcarComoPaga(id, dados) {
    this._marcarComoPaga.run(
      dados.paidAmount,
      dados.paidAt,
      dados.paymentDescription ?? null,
      dados.transactionId ?? null,
      id,
    );
    return this.buscarPorId(id);
  }
}