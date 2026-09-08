/**
 * PULSO — Repositório de Progressão (Fase 06 — Progressão)
 *
 * Segue o padrão estabelecido em repositorios/meta.js:
 * SQL vive somente aqui; statements preparados no construtor; métodos com
 * nomes de intenção; nenhuma regra de negócio (validação é do domínio).
 */

import {
  ATRIBUTOS,
  ATRIBUTO_VALOR_INICIAL,
  PONTOS_INICIAIS,
  XP_INICIAL,
} from '../../dominio/progressao.js';

const INSERIR_PROGRESSAO = `
  INSERT INTO jogador_progressao (jogador_id, xp_total, pontos_disponiveis)
  VALUES (?, ?, ?)
`;
const BUSCAR_PROGRESSAO = `
  SELECT id, jogador_id, xp_total, pontos_disponiveis, criado_em, atualizado_em
  FROM jogador_progressao
  WHERE jogador_id = ?
`;
const ATUALIZAR_PROGRESSAO = `
  UPDATE jogador_progressao
  SET xp_total = ?,
      pontos_disponiveis = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE jogador_id = ?
`;
const PROGRESSAO_EXISTE = `
  SELECT COUNT(*) AS total FROM jogador_progressao WHERE jogador_id = ?
`;

const INSERIR_ATRIBUTOS = `
  INSERT INTO jogador_atributo (jogador_id) VALUES (?)
`;
const BUSCAR_ATRIBUTOS = `
  SELECT id, jogador_id, tecnologia, criatividade, musica, social,
         energia, foco, disciplina, criado_em, atualizado_em
  FROM jogador_atributo
  WHERE jogador_id = ?
`;
const ATUALIZAR_ATRIBUTO = (atributo) => `
  UPDATE jogador_atributo
  SET ${atributo} = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE jogador_id = ?
`;
const ATRIBUTOS_EXISTEM = `
  SELECT COUNT(*) AS total FROM jogador_atributo WHERE jogador_id = ?
`;

/** Converte a linha de progressão em objeto (camelCase, congelado). */
function paraProgressao(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    xpTotal: linha.xp_total,
    pontosDisponiveis: linha.pontos_disponiveis,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  });
}

/** Converte a linha de atributos em objeto (camelCase, congelado). */
function paraAtributos(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    tecnologia: linha.tecnologia,
    criatividade: linha.criatividade,
    musica: linha.musica,
    social: linha.social,
    energia: linha.energia,
    foco: linha.foco,
    disciplina: linha.disciplina,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  });
}

export class RepositorioProgressao {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._inserirProgressao = banco.prepare(INSERIR_PROGRESSAO);
    this._buscarProgressao = banco.prepare(BUSCAR_PROGRESSAO);
    this._atualizarProgressao = banco.prepare(ATUALIZAR_PROGRESSAO);
    this._progressaoExiste = banco.prepare(PROGRESSAO_EXISTE);

    this._inserirAtributos = banco.prepare(INSERIR_ATRIBUTOS);
    this._buscarAtributos = banco.prepare(BUSCAR_ATRIBUTOS);
    this._atributosExiste = banco.prepare(ATRIBUTOS_EXISTEM);

    // Prepara statements de atualização por atributo
    this._atualizarPorAtributo = {};
    for (const atributo of ATRIBUTOS) {
      this._atualizarPorAtributo[atributo] = banco.prepare(ATUALIZAR_ATRIBUTO(atributo));
    }
  }

  // ── Progressão ────────────────────────────────────────────────────────

  /** Cria a progressão inicial de um jogador (XP=0, pontos=0). */
  criarProgressao(jogadorId) {
    this._inserirProgressao.run(jogadorId, XP_INICIAL, PONTOS_INICIAIS);
    return this.buscarProgressao(jogadorId);
  }

  /** Busca a progressão do jogador ou null. */
  buscarProgressao(jogadorId) {
    return paraProgressao(this._buscarProgressao.get(jogadorId));
  }

  /** Atualiza XP total e pontos disponíveis. */
  atualizarProgressao(jogadorId, { xpTotal, pontosDisponiveis }) {
    this._atualizarProgressao.run(xpTotal, pontosDisponiveis, jogadorId);
    return this.buscarProgressao(jogadorId);
  }

  /** Verifica se o jogador já possui progressão. */
  progressaoExiste(jogadorId) {
    return this._progressaoExiste.get(jogadorId).total > 0;
  }

  // ── Atributos ─────────────────────────────────────────────────────────

  /** Cria os atributos iniciais de um jogador (todos = 1). */
  criarAtributos(jogadorId) {
    this._inserirAtributos.run(jogadorId);
    return this.buscarAtributos(jogadorId);
  }

  /** Busca os atributos do jogador ou null. */
  buscarAtributos(jogadorId) {
    return paraAtributos(this._buscarAtributos.get(jogadorId));
  }

  /** Atribui pontos a um atributo específico (valor já validado). */
  atualizarAtributo(jogadorId, atributo, valor) {
    this._atualizarPorAtributo[atributo].run(valor, jogadorId);
    return this.buscarAtributos(jogadorId);
  }

  /** Verifica se o jogador já possui atributos. */
  atributosExiste(jogadorId) {
    return this._atributosExiste.get(jogadorId).total > 0;
  }
}
