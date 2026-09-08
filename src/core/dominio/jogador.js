/**
 * PULSO — Domínio: Jogador (Fase 03 — Jogador)
 *
 * Regras da identidade do operador. Funções puras: sem banco, sem Electron,
 * sem interface — validação authoritativa vive AQUI, não no renderer.
 *
 * Decisões registradas em docs/jogador.md:
 * - o codinome é OPCIONAL (null quando não informado);
 * - limites: nome ≤ 60 caracteres, codinome ≤ 40 (após aparar espaços);
 * - caracteres especiais NÃO são bloqueados (aplicação pessoal, sem
 *   exportação para sistemas externos — não há necessidade técnica).
 */

import { ErroValidacao } from '../erros.js';

export const LIMITE_NOME = 60;
export const LIMITE_CODINOME = 40;

/**
 * Valida e normaliza o nome do jogador.
 * @param {unknown} valor
 * @returns {string} nome aparado
 * @throws {ErroValidacao} quando vazio ou acima do limite
 */
export function validarNome(valor) {
  const nome = typeof valor === 'string' ? valor.trim() : '';
  if (nome.length === 0) {
    throw new ErroValidacao('O nome do operador é obrigatório.', 'nome');
  }
  if (nome.length > LIMITE_NOME) {
    throw new ErroValidacao(`O nome deve ter no máximo ${LIMITE_NOME} caracteres.`, 'nome');
  }
  return nome;
}

/**
 * Valida e normaliza o codinome (opcional).
 * @param {unknown} valor
 * @returns {string|null} codinome aparado ou null
 * @throws {ErroValidacao} quando acima do limite
 */
export function validarCodinome(valor) {
  const codinome = typeof valor === 'string' ? valor.trim() : '';
  if (codinome.length === 0) {
    return null; // opcional por decisão de produto
  }
  if (codinome.length > LIMITE_CODINOME) {
    throw new ErroValidacao(`O codinome deve ter no máximo ${LIMITE_CODINOME} caracteres.`, 'codinome');
  }
  return codinome;
}

/**
 * Valida o conjunto de identidade informado.
 * @param {{ nome?: unknown, codinome?: unknown }} dados
 * @returns {{ nome: string, codinome: string|null }} identidade congelada
 * @throws {ErroValidacao}
 */
export function validarIdentidade(dados = {}) {
  return Object.freeze({
    nome: validarNome(dados.nome),
    codinome: validarCodinome(dados.codinome),
  });
}
