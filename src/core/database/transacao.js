/**
 * PULSO — Transações (Fase 04 — Sistema de Status)
 *
 * Executa uma função dentro de uma transação SQLite:
 * sucesso → COMMIT; exceção → ROLLBACK + re-levantada.
 *
 * Usado para operações compostas que devem ser atômicas (ex.: criação do
 * jogador + criação do status inicial).
 */

/**
 * @template T
 * @param {import('node:sqlite').DatabaseSync} banco
 * @param {() => T} executar
 * @returns {T} retorno de `executar`
 */
export function comTransacao(banco, executar) {
  banco.exec('BEGIN IMMEDIATE');
  try {
    const resultado = executar();
    banco.exec('COMMIT');
    return resultado;
  } catch (erro) {
    banco.exec('ROLLBACK');
    throw erro;
  }
}