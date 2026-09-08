/**
 * PULSO — Repositório de metadados (Fase 02 — Banco de Dados)
 *
 * Estabelece o PADRÃO de repositório do PULSO (fases futuras seguem o modelo):
 *
 *   Módulo → Serviço/domínio → Repositório (aqui) → SQLite
 *
 * - SQL vive SOMENTE nos repositórios, nunca no domínio nem na interface;
 * - statements preparados uma vez, no construtor;
 * - métodos com nomes de intenção, sem vazamento de SQL;
 * - nenhuma regra de negócio aqui.
 *
 * Repositórios de sistemas futuros (jogador, missões, finanças…) serão
 * criados nas respectivas fases, cada um com sua(s) migração(ões).
 */

const SELECIONAR_VALOR = 'SELECT valor FROM meta WHERE chave = ?';
const DEFINIR_VALOR = `
  INSERT INTO meta (chave, valor) VALUES (?, ?)
  ON CONFLICT(chave) DO UPDATE SET
    valor = excluded.valor,
    atualizada_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
`;
const REMOVER_CHAVE = 'DELETE FROM meta WHERE chave = ?';

export class RepositorioMeta {
  /** @param {import('node:sqlite').DatabaseSync} banco conexão já inicializada */
  constructor(banco) {
    this._selecionarValor = banco.prepare(SELECIONAR_VALOR);
    this._definirValor = banco.prepare(DEFINIR_VALOR);
    this._removerChave = banco.prepare(REMOVER_CHAVE);
  }

  /**
   * Lê o valor de uma chave de metadado.
   * @param {string} chave
   * @param {{ padrao?: string }} [opcoes] valor devolvido quando a chave não existe
   * @returns {string|undefined}
   */
  obter(chave, { padrao } = {}) {
    const linha = this._selecionarValor.get(chave);
    return linha ? linha.valor : padrao;
  }

  /**
   * Cria ou atualiza uma chave de metadado.
   * @param {string} chave
   * @param {string|number|boolean} valor convertido para texto
   * @returns {string} valor armazenado
   */
  definir(chave, valor) {
    if (typeof chave !== 'string' || chave.length === 0) {
      throw new Error('RepositorioMeta.definir: a chave deve ser um texto não vazio.');
    }
    this._definirValor.run(chave, String(valor));
    return this.obter(chave);
  }

  /** Remove uma chave (não é erro remover chave inexistente). */
  remover(chave) {
    this._removerChave.run(chave);
  }
}
