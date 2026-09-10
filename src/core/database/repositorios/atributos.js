/**
 * PULSO — Repositório de Atributos (Fase 06 — Progressão)
 *
 * Padrão dos demais repositórios: SQL exclusivo aqui, statements no
 * construtor, sem regras de negócio (validação em dominio/progressao.js).
 */

const INSERIR = `
  INSERT INTO jogador_atributos
    (jogador_id, tecnologia, criatividade, musica, social, energia, foco, disciplina)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;
const BUSCAR = `
  SELECT id, jogador_id, tecnologia, criatividade, musica, social,
         energia, foco, disciplina, criado_em, atualizado_em
  FROM jogador_atributos
  WHERE jogador_id = ?
`;
const ATUALIZAR = `
  UPDATE jogador_atributos
  SET tecnologia = ?, criatividade = ?, musica = ?, social = ?,
      energia = ?, foco = ?, disciplina = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE jogador_id = ?
`;
const CONTAR = 'SELECT COUNT(*) AS total FROM jogador_atributos WHERE jogador_id = ?';

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

export class RepositorioAtributos {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._inserir = banco.prepare(INSERIR);
    this._buscar = banco.prepare(BUSCAR);
    this._atualizar = banco.prepare(ATUALIZAR);
    this._contar = banco.prepare(CONTAR);
  }

  /** Cria os atributos iniciais (todos em 1, já validados). */
  criar(jogadorId, valores) {
    this._inserir.run(
      jogadorId,
      valores.tecnologia,
      valores.criatividade,
      valores.musica,
      valores.social,
      valores.energia,
      valores.foco,
      valores.disciplina,
    );
    return this.buscarPorJogador(jogadorId);
  }

  /** Atributos do jogador ou null. */
  buscarPorJogador(jogadorId) {
    return paraAtributos(this._buscar.get(jogadorId));
  }

  /** Atualiza os 7 atributos e o carimbo atualizado_em. */
  atualizar(jogadorId, valores) {
    this._atualizar.run(
      valores.tecnologia,
      valores.criatividade,
      valores.musica,
      valores.social,
      valores.energia,
      valores.foco,
      valores.disciplina,
      jogadorId,
    );
    return this.buscarPorJogador(jogadorId);
  }

  /** Existem atributos para o jogador? */
  existe(jogadorId) {
    return this._contar.get(jogadorId).total > 0;
  }
}
