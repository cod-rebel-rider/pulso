/**
 * PULSO — Domínio: Progressão (Fase 06 — Progressão)
 *
 * Regras puras de XP, nível e atributos. Sem E/S, sem Electron, sem SQLite —
 * testável de forma isolada.
 *
 * Conceitos:
 * - XP total: valor acumulado (nunca negativo).
 * - Nível: derivado do XP total pela curva (nunca < 1).
 * - Pontos de atributo: concedidos a cada level up.
 * - Atributos: características de progressão (diferentes dos status operacionais).
 *
 * Diferença importante:
 * - STATUS (Fase 04): estado atual e mutável (energia, foco, estresse, criatividade).
 * - ATRIBUTOS (Fase 06): características de progressão (tecnologia, música, social…).
 * Energia/Foco existem em ambos, mas são conceitos distintos.
 */

import { ErroValidacao } from '../erros.js';

// ── Constantes de progressão ──────────────────────────────────────────────

/** Nível inicial do jogador. */
export const NIVEL_INICIAL = 1;

/** XP inicial do jogador. */
export const XP_INICIAL = 0;

/** Pontos de atributo iniciais (nível 1 não concede ponto). */
export const PONTOS_INICIAIS = 0;

/** Pontos de atributo concedidos por nível conquistado. */
export const PONTOS_POR_NIVEL = 1;

/** Valor mínimo de um atributo. */
export const ATRIBUTO_MINIMO = 1;

/** Valor máximo de um atributo (teto de segurança). */
export const ATRIBUTO_MAXIMO = 100;

// ── Curva de XP ──────────────────────────────────────────────────────────

/**
 * Calcula o XP necessário para avançar do nível `nivelAtual` para o próximo.
 *
 * Fórmula: 100 × nível atual.
 *
 * Exemplos:
 * - Nível 1 → 2: 100 XP
 * - Nível 2 → 3: 200 XP
 * - Nível 3 → 4: 300 XP
 *
 * @param {number} nivelAtual nível atual (≥ 1)
 * @returns {number} XP necessário para o próximo nível
 */
export function xpParaProximoNivel(nivelAtual) {
  if (!Number.isInteger(nivelAtual) || nivelAtual < 1) {
    throw new ErroValidacao(`Nível inválido para cálculo de XP: ${nivelAtual}.`);
  }
  return 100 * nivelAtual;
}

/**
 * Calcula o nível a partir do XP total.
 *
 * O nível é o maior inteiro N tal que a soma cumulativa de XP até N
 * não ultrapasse o XP total.
 *
 * @param {number} xpTotal XP acumulado (≥ 0)
 * @returns {number} nível calculado (≥ 1)
 */
export function calcularNivel(xpTotal) {
  if (!Number.isFinite(xpTotal) || xpTotal < 0) {
    throw new ErroValidacao(`XP total inválido: ${xpTotal}.`);
  }
  let nivel = 1;
  let xpAcumulado = 0;
  while (true) {
    const xpNecessario = xpParaProximoNivel(nivel);
    if (xpAcumulado + xpNecessario > xpTotal) break;
    xpAcumulado += xpNecessario;
    nivel += 1;
  }
  return nivel;
}

/**
 * Calcula o progresso dentro do nível atual.
 *
 * @param {number} xpTotal XP acumulado
 * @returns {{ nivel: number, xpNoNivel: number, xpNecessario: number, progresso: number }}
 *   - nível: nível atual
 *   - xpNoNivel: XP dentro do nível atual
 *   - xpNecessário: XP necessário para o próximo nível
 *   - progresso: percentual (0–100) do nível atual
 */
export function calcularProgresso(xpTotal) {
  const nivel = calcularNivel(xpTotal);
  let xpAcumulado = 0;
  for (let n = 1; n < nivel; n += 1) {
    xpAcumulado += xpParaProximoNivel(n);
  }
  const xpNoNivel = xpTotal - xpAcumulado;
  const xpNecessario = xpParaProximoNivel(nivel);
  const progresso = Math.round((xpNoNivel / xpNecessario) * 100);
  return { nivel, xpNoNivel, xpNecessario, progresso };
}

// ── Atributos ─────────────────────────────────────────────────────────────

/** Lista oficial de atributos (ordem de exibição). */
export const ATRIBUTOS = Object.freeze([
  'tecnologia',
  'criatividade',
  'musica',
  'social',
  'energia',
  'foco',
  'disciplina',
]);

/** Rótulos em PT-BR para exibição. */
export const ATRIBUTOS_ROTULOS = Object.freeze({
  tecnologia: 'Tecnologia',
  criatividade: 'Criatividade',
  musica: 'Música',
  social: 'Social',
  energia: 'Energia',
  foco: 'Foco',
  disciplina: 'Disciplina',
});

/** Valor inicial de cada atributo. */
export const ATRIBUTO_VALOR_INICIAL = 1;

/**
 * Cria o objeto de atributos com valores iniciais.
 * @returns {{ [atributo]: number }} atributos inicializados em 1
 */
export function criarAtributosIniciais() {
  const atributos = {};
  for (const nome of ATRIBUTOS) {
    atributos[nome] = ATRIBUTO_VALOR_INICIAL;
  }
  return Object.freeze(atributos);
}

/**
 * Valida o nome de um atributo.
 * @param {unknown} nome
 * @returns {string} nome validado
 * @throws {ErroValidacao} quando o atributo não existe
 */
export function validarNomeAtributo(nome) {
  if (typeof nome !== 'string' || !ATRIBUTOS.includes(nome)) {
    throw new ErroValidacao(`Atributo desconhecido: "${nome}".`);
  }
  return nome;
}

/**
 * Valida um valor de atributo (deve ser inteiro dentro dos limites).
 * @param {unknown} valor
 * @returns {number} valor validado e limitado
 * @throws {ErroValidacao} quando o valor é inválido
 */
export function validarValorAtributo(valor) {
  if (!Number.isInteger(valor)) {
    throw new ErroValidacao(`Valor de atributo deve ser inteiro: ${valor}.`);
  }
  if (valor < ATRIBUTO_MINIMO) {
    throw new ErroValidacao(`Atributo não pode ser menor que ${ATRIBUTO_MINIMO}: ${valor}.`);
  }
  if (valor > ATRIBUTO_MAXIMO) {
    throw new ErroValidacao(`Atributo não pode ser maior que ${ATRIBUTO_MAXIMO}: ${valor}.`);
  }
  return valor;
}

/**
 * Valida a quantidade de pontos a distribuir.
 * @param {unknown} quantidade
 * @returns {number} quantidade validada
 * @throws {ErroValidacao} quando é inválida
 */
export function validarQuantidadePontos(quantidade) {
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new ErroValidacao(`Quantidade de pontos deve ser inteiro positivo: ${quantidade}.`);
  }
  return quantidade;
}

/**
 * Valida XP a adicionar (deve ser positivo).
 * @param {unknown} quantidade
 * @returns {number} quantidade validada
 * @throws {ErroValidacao} quando é inválida
 */
export function validarXp(quantidade) {
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new ErroValidacao(`XP a adicionar deve ser inteiro positivo: ${quantidade}.`);
  }
  return quantidade;
}

/**
 * Calcula quantos níveis foram conquistados ao adicionar XP.
 *
 * @param {number} xpTotal XP total antes da adição
 * @param {number} xpGanho XP a adicionar (positivo)
 * @returns {{ nivelAntigo: number, nivelNovo: number, niveisGanhos: number }}
 */
export function calcularLevelUp(xpTotal, xpGanho) {
  validarXp(xpGanho);
  const nivelAntigo = calcularNivel(xpTotal);
  const nivelNovo = calcularNivel(xpTotal + xpGanho);
  const niveisGanhos = nivelNovo - nivelAntigo;
  return { nivelAntigo, nivelNovo, niveisGanhos };
}