/**
 * PULSO — Repositório do Jogador (Fase 03 — Jogador)
 *
 * Segue o padrão estabelecido em repositorios/meta.js:
 * SQL vive somente aqui; statements preparados no construtor; métodos com
 * nomes de intenção; nenhuma regra de negócio (validação é do domínio).
 */

const INSERIR_JOGADOR = 'INSERT INTO jogador (nome, codinome) VALUES (?, ?)';
const BUSCAR_PRIMEIRO =
  'SELECT id, nome, codinome, criado_em, atualizado_em FROM jogador ORDER BY id LIMIT 1';
const BUSCAR_POR_ID =
  'SELECT id, nome, codinome, criado_em, atualizado_em FROM jogador WHERE id = ?';
const ATUALIZAR_JOGADOR = `
  UPDATE jogador
  SET nome = ?,
      codinome = ?,
      atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`;
const CONTAR_JOGADORES = 'SELECT COUNT(*) AS total FROM jogador';

/** Converte a linha do banco em objeto de jogador (camelCase, congelado). */
function paraJogador(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    nome: linha.nome,
    codinome: linha.codinome ?? null,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  });
}

export class RepositorioJogador {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._inserir = banco.prepare(INSERIR_JOGADOR);
    this._primeiro = banco.prepare(BUSCAR_PRIMEIRO);
    this._porId = banco.prepare(BUSCAR_POR_ID);
    this._atualizar = banco.prepare(ATUALIZAR_JOGADOR);
    this._contar = banco.prepare(CONTAR_JOGADORES);
  }

  /**
   * Cria um jogador (dados já validados pelo domínio/serviço).
   * @param {{ nome: string, codinome: string|null }} identidade
   * @returns {object} jogador criado
   */
  criar({ nome, codinome }) {
    this._inserir.run(nome, codinome);
    return this.buscarPrimeiro();
  }

  /** Primeiro jogador (aplicação single-player) ou null. */
  buscarPrimeiro() {
    return paraJogador(this._primeiro.get());
  }

  /** Jogador pelo identificador interno ou null. */
  buscarPorId(id) {
    return paraJogador(this._porId.get(id));
  }

  /**
   * Atualiza a identidade e o carimbo `atualizado_em`.
   * @param {number} id
   * @param {{ nome: string, codinome: string|null }} identidade
   * @returns {object|null} jogador atualizado
   */
  atualizar(id, { nome, codinome }) {
    this._atualizar.run(nome, codinome, id);
    return this.buscarPorId(id);
  }

  /** Responde "existe um jogador configurado?". */
  existe() {
    return this._contar.get().total > 0;
  }
}
