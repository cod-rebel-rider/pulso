/**
 * PULSO — Domínio: Progressão (Fase 06 — Progressão)
 *
 * Motor de evolução do personagem. Regras puras, sem E/S: a curva de XP,
 * o cálculo de nível, a concessão de pontos e a distribuição de atributos
 * vivem AQUI — nunca no renderer, nunca no SQL.
 *
 * Conceito (docs/progressao.md): XP → Nível → Pontos → Atributos
 */

import { ErroValidacao } from '../erros.js';

export const NIVEL_INICIAL = 1;
export const XP_INICIAL = 0;
export const PONTOS_INICIAIS = 0;
export const VALOR_INICIAL_ATRIBUTO = 1;
export const PONTOS_POR_NIVEL = 1;

/** Atributos fundamentais — a ordem aqui é a ordem de exibição. */
export const ATRIBUTOS_DISPONIVEIS = Object.freeze([
  'tecnologia',
  'criatividade',
  'musica',
  'social',
  'energia',
  'foco',
  'disciplina',
]);

/** Rótulos em pt-BR para exibição. */
export const ATRIBUTOS_ROTULOS = Object.freeze({
  tecnologia: 'TECNOLOGIA',
  criatividade: 'CRIATIVIDADE',
  musica: 'MÚSICA',
  social: 'SOCIAL',
  energia: 'ENERGIA',
  foco: 'FOCO',
  disciplina: 'DISCIPLINA',
});

/** Origens de XP previstas (nenhum módulo as usa ainda — Fase 06). */
export const ORIGENS_XP = Object.freeze(['MISSAO', 'PROJETO', 'CONQUISTA', 'OUTRO']);

/**
 * XP necessário para sair do `nivel` em direção ao próximo.
 * Curva da Fase 06: linear e previsível — 100 × nível atual.
 * Nível 1 → 100 XP · nível 2 → 200 XP · nível 3 → 300 XP …
 */
export function xpNecessarioParaProximoNivel(nivel) {
  if (!Number.isInteger(nivel) || nivel < NIVEL_INICIAL) {
    throw new ErroValidacao(`Nível inválido: "${String(nivel)}". O nível mínimo é ${NIVEL_INICIAL}.`, 'nivel');
  }
  return 100 * nivel;
}

/** Valida o XP total acumulado (inteiro ≥ 0). */
export function validarXpTotal(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || !Number.isInteger(valor)) {
    throw new ErroValidacao('O XP total deve ser um número inteiro válido.', 'xp');
  }
  if (valor < 0) {
    throw new ErroValidacao('O XP total não pode ser negativo.', 'xp');
  }
  return valor;
}

/** Valida XP a conceder (zero aceito; negativo rejeitado). */
export function validarQuantidadeXp(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || !Number.isInteger(valor)) {
    throw new ErroValidacao('A quantidade de XP deve ser um número inteiro válido.', 'quantidade');
  }
  if (valor < 0) {
    throw new ErroValidacao('A quantidade de XP não pode ser negativa.', 'quantidade');
  }
  return valor;
}

/** Calcula o nível correspondente ao XP total acumulado. */
export function calcularNivel(xpTotal) {
  validarXpTotal(xpTotal);
  let nivel = NIVEL_INICIAL;
  let restante = xpTotal;
  while (restante >= xpNecessarioParaProximoNivel(nivel)) {
    restante -= xpNecessarioParaProximoNivel(nivel);
    nivel += 1;
  }
  return nivel;
}

/** Detalha o progresso dentro do nível atual. */
export function calcularProgresso(xpTotal) {
  validarXpTotal(xpTotal);
  let nivel = NIVEL_INICIAL;
  let restante = xpTotal;
  while (restante >= xpNecessarioParaProximoNivel(nivel)) {
    restante -= xpNecessarioParaProximoNivel(nivel);
    nivel += 1;
  }
  const xpNecessario = xpNecessarioParaProximoNivel(nivel);
  return Object.freeze({
    nivel,
    xpNoNivel: restante,
    xpNecessario,
    progresso: xpNecessario === 0 ? 0 : restante / xpNecessario,
  });
}

/**
 * Concede XP ao estado atual. Cada nível concede PONTOS_POR_NIVEL pontos.
 * Processa múltiplos níveis de uma só vez.
 */
export function adicionarXp(atual, quantidade) {
  validarQuantidadeXp(quantidade);
  validarXpTotal(atual.xpTotal);
  const xpTotal = atual.xpTotal + quantidade;
  const nivel = calcularNivel(xpTotal);
  const niveisGanhos = nivel - atual.nivel;
  if (niveisGanhos < 0) {
    throw new ErroValidacao('Progressão inconsistente: nível atual maior que o calculado.', 'nivel');
  }
  return Object.freeze({
    xpTotal,
    nivel,
    pontosDisponiveis: atual.pontosDisponiveis + niveisGanhos * PONTOS_POR_NIVEL,
    subiuNivel: niveisGanhos > 0,
    niveisGanhos,
  });
}

/** Rejeita nome de atributo desconhecido. */
export function validarNomeAtributo(nome) {
  if (!ATRIBUTOS_DISPONIVEIS.includes(nome)) {
    throw new ErroValidacao(
      `Atributo desconhecido: "${String(nome)}". Disponíveis: ${ATRIBUTOS_DISPONIVEIS.join(', ')}.`,
      'atributo',
    );
  }
  return nome;
}

/** Valida pontos disponíveis (nunca negativos). */
export function validarPontosDisponiveis(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || !Number.isInteger(valor)) {
    throw new ErroValidacao('Os pontos de atributo devem ser um número inteiro válido.', 'pontos');
  }
  if (valor < 0) {
    throw new ErroValidacao('Os pontos de atributo não podem ser negativos.', 'pontos');
  }
  return valor;
}

/** Distribui pontos em um atributo (operação incremental controlada). */
export function aumentarAtributo(atual, nome, quantidade) {
  validarNomeAtributo(nome);
  if (typeof quantidade !== 'number' || !Number.isFinite(quantidade) || !Number.isInteger(quantidade)) {
    throw new ErroValidacao('A quantidade deve ser um número inteiro válido.', 'quantidade');
  }
  if (quantidade <= 0) {
    throw new ErroValidacao('A quantidade deve ser maior que zero.', 'quantidade');
  }
  validarPontosDisponiveis(atual.pontosDisponiveis);
  if (quantidade > atual.pontosDisponiveis) {
    throw new ErroValidacao(
      `Pontos insuficientes: disponíveis ${atual.pontosDisponiveis}, solicitados ${quantidade}.`,
      'pontos',
    );
  }
  const valorAtual = atual.atributos[nome];
  if (typeof valorAtual !== 'number' || !Number.isInteger(valorAtual) || valorAtual < VALOR_INICIAL_ATRIBUTO) {
    throw new ErroValidacao(`Valor atual inválido para o atributo "${nome}".`, 'atributo');
  }
  return Object.freeze({
    atributos: Object.freeze({ ...atual.atributos, [nome]: valorAtual + quantidade }),
    pontosDisponiveis: atual.pontosDisponiveis - quantidade,
  });
}

/** Todos os atributos começam em 1 (base sem evolução). */
export function atributosIniciais() {
  const iniciais = {};
  for (const nome of ATRIBUTOS_DISPONIVEIS) {
    iniciais[nome] = VALOR_INICIAL_ATRIBUTO;
  }
  return Object.freeze(iniciais);
}

