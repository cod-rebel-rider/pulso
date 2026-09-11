/**
 * PULSO — Repositório de Projetos (Fase 07 — Projetos)
 *
 * Padrão dos demais repositórios: SQL exclusivo aqui, statements no
 * construtor, sem regras de negócio (transições em dominio/projeto.js).
 */

import { paraProjeto } from '../../dominio/projeto.js';
import { paraMissao } from '../../dominio/missao.js';

const INSERIR = `
  INSERT INTO projeto (jogador_id, titulo, descricao, estado, prioridade, prazo)
  VALUES (?, ?, ?, ?, ?, ?)
`;
const BUSCAR_POR_ID = `
  SELECT id, jogador_id, titulo, descricao, estado, prioridade, prazo,
         criado_em, atualizado_em, iniciada_em, concluida_em, cancelada_em
  FROM projeto WHERE id = ?
`;
const LISTAR_POR_JOGADOR = `
  SELECT id, jogador_id, titulo, descricao, estado, prioridade, prazo,
         criado_em, atualizado_em, iniciada_em, concluida_em, cancelada_em
  FROM projeto WHERE jogador_id = ?
  ORDER BY
    CASE estado
      WHEN 'em_andamento' THEN 1
      WHEN 'planejado' THEN 2
      WHEN 'concluido' THEN 3
      WHEN 'cancelado' THEN 4
      WHEN 'arquivado' THEN 5
      ELSE 6
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
const ATUALIZAR = `
  UPDATE projeto
  SET titulo = ?, descricao = ?, estado = ?, prioridade = ?, prazo = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      iniciada_em = ?, concluida_em = ?, cancelada_em = ?
  WHERE id = ?
`;
const EXCLUIR = 'DELETE FROM projeto WHERE id = ?';
const MISSOES_DO_PROJETO = `
  SELECT id, jogador_id, titulo, descricao, estado, prioridade, prazo,
         criado_em, atualizado_em, iniciada_em, concluida_em, cancelada_em
  FROM missao WHERE projeto_id = ? ORDER BY criado_em DESC
`;
const VINCULAR_MISSAO = `
  UPDATE missao
  SET projeto_id = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;
const DESVINCULAR_MISSAO = `
  UPDATE missao
  SET projeto_id = NULL,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;

export class RepositorioProjeto {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._banco = banco;
    this._inserir = banco.prepare(INSERIR);
    this._porId = banco.prepare(BUSCAR_POR_ID);
    this._listar = banco.prepare(LISTAR_POR_JOGADOR);
    this._atualizar = banco.prepare(ATUALIZAR);
    this._excluir = banco.prepare(EXCLUIR);
    this._missoes = banco.prepare(MISSOES_DO_PROJETO);
    this._vincular = banco.prepare(VINCULAR_MISSAO);
    this._desvincular = banco.prepare(DESVINCULAR_MISSAO);
  }

  /** Cria um projeto (dados já validados pelo domínio/serviço). */
  criar(jogadorId, dados, estado = 'planejado') {
    this._inserir.run(jogadorId, dados.titulo, dados.descricao, estado, dados.prioridade, dados.prazo);
    const linha = this._banco.prepare('SELECT last_insert_rowid() AS id').get();
    return this.buscarPorId(linha.id);
  }

  /** Projeto pelo id ou null. */
  buscarPorId(id) {
    return paraProjeto(this._porId.get(id));
  }

  /** Todos os projetos de um jogador (ordenados). */
  listarPorJogador(jogadorId) {
    return this._listar.all(jogadorId).map(paraProjeto);
  }

  /** Atualiza um projeto existente (dados completos já resolvidos). */
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

  /** Exclusão física (uso técnico controlado — interface prefere arquivar). */
  excluir(id) {
    this._excluir.run(id);
  }

  /** Missões vinculadas ao projeto. */
  listarMissoes(projetoId) {
    return this._missoes.all(projetoId).map((linha) => paraMissao({ ...linha, projeto_id: projetoId }));
  }

  /** Vincula uma missão existente ao projeto (referência, sem cópia). */
  vincularMissao(missaoId, projetoId) {
    this._vincular.run(projetoId, missaoId);
  }

  /** Remove a missão do projeto (missão continua existindo, sem projeto). */
  desvincularMissao(missaoId) {
    this._desvincular.run(missaoId);
  }
}
