/**
 * PULSO — Domínio: Status (Fase 04 — Sistema de Status)
 *
 * Os status representam o estado operacional percebido do jogador DENTRO
 * do PULSO — mecânicas de gameplay/organização pessoal. NÃO são diagnóstico
 * médico, avaliação psicológica nem medição clínica.
 *
 * Regras centrais (funções puras, independentes da interface/banco):
 * - faixa sempre 0–100 (limites centralizados aqui, nunca nas telas);
 * - status desconhecido é rejeitado;
 * - valores não numéricos são rejeitados;
 * - valores iniciais são constantes claramente identificadas.
 */

import { ErroValidacao } from '../erros.js';

export const LIMITE_MINIMO = 0;
export const LIMITE_MAXIMO = 100;

/** Status disponíveis no PULSO — a ordem aqui é a ordem de exibição. */
export const STATUS_DISPONIVEIS = Object.freeze(['energia', 'foco', 'estresse', 'criatividade']);

/** Estado inicial do jogador (docs/status.md). */
export const VALORES_INICIAIS = Object.freeze({
  energia: 100,
  foco: 100,
  estresse: 0,
  criatividade: 100,
});

/**
 * Rejeita nome de status desconhecido.
 * @param {string} nome
 * @returns {string} nome validado
 * @throws {ErroValidacao}
 */
export function validarNomeStatus(nome) {
  if (!STATUS_DISPONIVEIS.includes(nome)) {
    throw new ErroValidacao(
      `Status desconhecido: "${String(nome)}". Disponíveis: ${STATUS_DISPONIVEIS.join(', ')}.`,
      'status',
    );
  }
  return nome;
}

/** Centraliza o limite 0–100 (ex.: 150→100, -20→0). */
export function limitar(valor) {
  return Math.min(LIMITE_MAXIMO, Math.max(LIMITE_MINIMO, valor));
}

function validarNumero(valor, rotulo) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ErroValidacao(`O valor de ${rotulo} deve ser um número válido.`, rotulo);
  }
  return valor;
}

/**
 * Valida um delta de alteração (ex.: -10, +15).
 * @param {unknown} delta
 * @returns {number}
 * @throws {ErroValidacao}
 */
export function validarDelta(delta) {
  return validarNumero(delta, 'alteração');
}

/**
 * Calcula o novo valor de um status após uma alteração, respeitando 0–100.
 * @param {string} nome
 * @param {number} atual
 * @param {number} delta
 * @returns {number}
 * @throws {ErroValidacao}
 */
export function calcularNovoValor(nome, atual, delta) {
  validarNomeStatus(nome);
  return limitar(validarNumero(atual, nome) + validarDelta(delta));
}

/**
 * Valida e limita um valor absoluto proposto para um status.
 * @param {string} nome
 * @param {unknown} valor
 * @returns {number}
 * @throws {ErroValidacao}
 */
export function validarValorAbsoluto(nome, valor) {
  validarNomeStatus(nome);
  return limitar(validarNumero(valor, nome));
}