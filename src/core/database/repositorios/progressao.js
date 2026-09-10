/**
 * PULSO — Repositório de Progressão (Fase 06 — Progressão)
 *
 * Segue o padrão dos demais repositórios: SQL somente aqui, statements
 * preparados no construtor, métodos com nomes de intenção, sem regras de
 * negócio (curva de XP e level up ficam em src/core/dominio/progressao.js).
 */

const INSERIR = `
  INSERT INTO jogador_progressao (jogador_id, xp_total, nivel, pontos_disponiveis)
  VALUES (?, ?, ?, ?)
`;
const BUSCAR_POR_JOGADOR = `
  SELECT id, jogador_id, xp_total, nivel, pontos_disponiveis, criado_em, atualizado_em
  FROM jogador_progressao
  WHERE jogador_id = ?
`;
const ATUALIZAR = `
  UPDATE jogador_progressao
  SET xp_total = ?,
      nivel = ?,
      pontos_disponiveis = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE jogador_id = ?
`;
const CONTAR = 'SELECT COUNT(*) AS total FROM jogador_progressao WHERE jogador_id = ?';

/** Converte a linha do banco em objeto de progressão (camelCase, congelado). */
function paraProgressao(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    xpTotal: linha.xp_total,
    nivel: linha.nivel,
    pontosDisponiveis: linha.pontos_disponiveis,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  });
}

export class RepositorioProgressao {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._inserir = banco.prepare(INSERIR);
    this._buscar = banco.prepare(BUSCAR_POR_JOGADOR);
    this._atualizar = banco.prepare(ATUALIZAR);
    this._contar = banco.prepare(CONTAR);
  }

  /** Cria a progressão inicial (valores já validados pelo domínio/serviço). */
  criar(jogadorId, { xpTotal, nivel, pontosDisponiveis }) {
    this._inserir.run(jogadorId, xpTotal, nivel, pontosDisponiveis);
    return this.buscarPorJogador(jogadorId);
  }

  /** Progressão do jogador ou null. */
  buscarPorJogador(jogadorId) {
    return paraProgressao(this._buscar.get(jogadorId));
  }

  /** Atualiza XP/nível/pontos e o carimbo atualizado_em. */
  atualizar(jogadorId, { xpTotal, nivel, pontosDisponiveis }) {
    this._atualizar.run(xpTotal, nivel, pontosDisponiveis, jogadorId);
    return this.buscarPorJogador(jogadorId);
  }

  /** Existe progressão para o jogador? */
  existe(jogadorId) {
    return this._contar.get(jogadorId).total > 0;
  }
}
