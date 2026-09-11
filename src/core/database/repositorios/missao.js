/**
 * PULSO — Repositório de Missões (Fase 05 — Missões)
 *
 * Segue o padrão estabelecido em repositorios/meta.js:
 * SQL vive somente aqui; statements preparados no construtor; métodos com
 * nomes de intenção; nenhuma regra de negócio (transições são do domínio).
 */

import {
  paraMissao,
  ESTADOS,
  PRIORIDADES,
} from '../../dominio/missao.js';

const INSERIR_MISSAO = `
  INSERT INTO missao (jogador_id, titulo, descricao, estado, prioridade, prazo)
  VALUES (?, ?, ?, ?, ?, ?)
`;
const BUSCAR_POR_ID = `
  SELECT id, jogador_id, titulo, descricao, estado, prioridade, prazo, projeto_id,
         criado_em, atualizado_em, iniciada_em, concluida_em, cancelada_em
  FROM missao WHERE id = ?
`;
const LISTAR_POR_JOGADOR = `
  SELECT id, jogador_id, titulo, descricao, estado, prioridade, prazo, projeto_id,
         criado_em, atualizado_em, iniciada_em, concluida_em, cancelada_em
  FROM missao WHERE jogador_id = ?
  ORDER BY
    CASE estado
      WHEN 'em_andamento' THEN 1
      WHEN 'pendente' THEN 2
      WHEN 'concluida' THEN 3
      WHEN 'cancelada' THEN 4
      ELSE 5
    END,
    CASE prioridade
      WHEN 'critica' THEN 1
      WHEN 'alta' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'baixa' THEN 4
      ELSE 5
    END,
    prazo ASC,
    criado_em DESC
`;
const ATUALIZAR_MISSAO = `
  UPDATE missao
  SET titulo = ?,
      descricao = ?,
      estado = ?,
      prioridade = ?,
      prazo = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      iniciada_em = ?,
      concluida_em = ?,
      cancelada_em = ?
  WHERE id = ?
`;
const EXCLUIR_MISSAO = 'DELETE FROM missao WHERE id = ?';
const CONTAR_POR_JOGADOR_ESTADO =
  'SELECT COUNT(*) AS total FROM missao WHERE jogador_id = ? AND estado = ?';

export class RepositorioMissao {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._banco = banco;
    this._inserir = banco.prepare(INSERIR_MISSAO);
    this._porId = banco.prepare(BUSCAR_POR_ID);
    this._listar = banco.prepare(LISTAR_POR_JOGADOR);
    this._atualizar = banco.prepare(ATUALIZAR_MISSAO);
    this._excluir = banco.prepare(EXCLUIR_MISSAO);
    this._contarEstado = banco.prepare(CONTAR_POR_JOGADOR_ESTADO);
  }

  /**
   * Cria uma missão (dados já validados pelo domínio/serviço).
   * @param {number} jogadorId
   * @param {{ titulo: string, descricao: string|null, prioridade: string, prazo: string|null }} dados
   * @param {string} [estado] padrão: pendente
   * @returns {object} missão criada
   */
  criar(jogadorId, dados, estado = ESTADOS.PENDENTE) {
    this._inserir.run(
      jogadorId,
      dados.titulo,
      dados.descricao,
      estado,
      dados.prioridade,
      dados.prazo,
    );
    const linha = this._banco.prepare('SELECT last_insert_rowid() AS id').get();
    return this.buscarPorId(linha.id);
  }

  /** Missão pelo id ou null. */
  buscarPorId(id) {
    return paraMissao(this._porId.get(id));
  }

  /** Todas as missões de um jogador (ordenadas). */
  listarPorJogador(jogadorId) {
    return this._listar.all(jogadorId).map(paraMissao);
  }

  /**
   * Atualiza uma missão existente.
   * @param {number} id
   * @param {{ titulo: string, descricao: string|null, estado: string, prioridade: string, prazo: string|null, iniciadaEm: string|null, concluidaEm: string|null, canceladaEm: string|null }} dados
   * @returns {object|null} missão atualizada
   */
  atualizar(id, dados) {
    this._atualizar.run(
      dados.titulo,
      dados.descricao,
      dados.estado,
      dados.prioridade,
      dados.prazo,
      dados.iniciadaEm ?? null,
      dados.concluidaEm ?? null,
      dados.canceladaEm ?? null,
      id,
    );
    return this.buscarPorId(id);
  }

  /** Exclui uma missão pelo id. */
  excluir(id) {
    this._excluir.run(id);
  }

  /** Conta missões de um jogador em determinado estado. */
  contarPorEstado(jogadorId, estado) {
    return this._contarEstado.get(jogadorId, estado).total;
  }
}

