/**
 * PULSO — Domínio: Missão (Fase 05 — Missões)
 *
 * Regras puras, sem E/S. Toda validação, cálculo de transição e
 * manipulação de estados vive aqui — nunca na interface, nunca no repositório.
 */

import { ErroValidacao, ErroTransicao } from '../erros.js';

// ── Estados ─────────────────────────────────────────────────────────
export const ESTADOS = Object.freeze({
  PENDENTE: 'pendente',
  EM_ANDAMENTO: 'em_andamento',
  CONCLUIDA: 'concluida',
  CANCELADA: 'cancelada',
});

export const ESTADOS_ORDEM = Object.freeze([
  ESTADOS.PENDENTE,
  ESTADOS.EM_ANDAMENTO,
  ESTADOS.CONCLUIDA,
  ESTADOS.CANCELADA,
]);

export const ESTADOS_ROTULOS = Object.freeze({
  [ESTADOS.PENDENTE]: 'Pendente',
  [ESTADOS.EM_ANDAMENTO]: 'Em andamento',
  [ESTADOS.CONCLUIDA]: 'Concluída',
  [ESTADOS.CANCELADA]: 'Cancelada',
});

// ── Prioridades ──────────────────────────────────────────────────────
export const PRIORIDADES = Object.freeze({
  BAIXA: 'baixa',
  NORMAL: 'normal',
  ALTA: 'alta',
  CRITICA: 'critica',
});

export const PRIORIDADES_ORDEM = Object.freeze([
  PRIORIDADES.BAIXA,
  PRIORIDADES.NORMAL,
  PRIORIDADES.ALTA,
  PRIORIDADES.CRITICA,
]);

export const PRIORIDADES_ROTULOS = Object.freeze({
  [PRIORIDADES.BAIXA]: 'Baixa',
  [PRIORIDADES.NORMAL]: 'Normal',
  [PRIORIDADES.ALTA]: 'Alta',
  [PRIORIDADES.CRITICA]: 'Crítica',
});

// ── Tamanhos máximos ────────────────────────────────────────────────
// ── Validação ───────────────────────────────────────────────────────

/** Verifica se o valor é uma string não vazia (após trim). */
function textoNaoVazio(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

/** Valida o título da missão. */
export function validarTitulo(titulo) {
  if (!textoNaoVazio(titulo)) {
    throw new ErroValidacao('O título da missão é obrigatório.');
  }
  const aparado = titulo.trim();
  if (aparado.length > TAMANHO_MAXIMO.TITULO) {
    throw new ErroValidacao(`O título pode ter no máximo ${TAMANHO_MAXIMO.TITULO} caracteres.`);
  }
  return aparado;
}

/** Valida a descrição (opcional, mas se fornecida deve ser string). */
export function validarDescricao(descricao) {
  if (descricao === null || descricao === undefined || descricao === '') {
    return null;
  }
  if (typeof descricao !== 'string') {
    throw new ErroValidacao('A descrição deve ser um texto.');
  }
  const aparada = descricao.trim();
  if (aparada.length === 0) return null;
  if (aparada.length > TAMANHO_MAXIMO.DESCRICAO) {
    throw new ErroValidacao(`A descrição pode ter no máximo ${TAMANHO_MAXIMO.DESCRICAO} caracteres.`);
  }
  return aparada;
}

/** Valida o nome do estado. */
export function validarEstado(estado) {
  if (!ESTADOS_ORDEM.includes(estado)) {
    throw new ErroValidacao(`Estado inválido: ${String(estado)}`);
  }
  return estado;
}

/** Valida a prioridade. */
export function validarPrioridade(prioridade) {
  if (!PRIORIDADES_ORDEM.includes(prioridade)) {
    throw new ErroValidacao(`Prioridade inválida: ${String(prioridade)}`);
  }
  return prioridade;
}

/** Valida o prazo (deve ser uma data ISO válida ou null). */
export function validarPrazo(prazo) {
  if (prazo === null || prazo === undefined || prazo === '') {
    return null;
  }
  if (typeof prazo !== 'string') {
    throw new ErroValidacao('O prazo deve ser uma data válida.');
  }
  const data = new Date(prazo);
  if (Number.isNaN(data.getTime())) {
    throw new ErroValidacao('O prazo não é uma data válida.');
  }
  return data.toISOString();
}

/** Valida um conjunto de dados para criação de missão. */
export function validarMissaoCriacao(dados) {
  return Object.freeze({
    titulo: validarTitulo(dados.titulo),
    descricao: validarDescricao(dados.descricao),
    prioridade: validarPrioridade(dados.prioridade ?? PRIORIDADES.NORMAL),
    prazo: validarPrazo(dados.prazo),
  });
}

/** Valida dados para edição (campos parciais). */
export function validarMissaoEdicao(dados) {
  const resultado = {};
  if ('titulo' in dados) resultado.titulo = validarTitulo(dados.titulo);
  if ('descricao' in dados) resultado.descricao = validarDescricao(dados.descricao);
  if ('prioridade' in dados) resultado.prioridade = validarPrioridade(dados.prioridade);
  if ('prazo' in dados) resultado.prazo = validarPrazo(dados.prazo);
  return Object.freeze(resultado);
}

export const TAMANHO_MAXIMO = Object.freeze({
  TITULO: 120,
  DESCRICAO: 2000,
});

// ── Valores padrão ─────────────────────────────────────────────────
export const ESTADO_INICIAL = ESTADOS.PENDENTE;
export const PRIORIDADE_PADRAO = PRIORIDADES.NORMAL;

// ── Transições permitidas (máquina de estados) ──────────────────────
const TRANSICOES_PERMITIDAS = Object.freeze({
  [ESTADOS.PENDENTE]: Object.freeze([ESTADOS.EM_ANDAMENTO, ESTADOS.CANCELADA]),
  [ESTADOS.EM_ANDAMENTO]: Object.freeze([ESTADOS.CONCLUIDA, ESTADOS.CANCELADA]),
  [ESTADOS.CONCLUIDA]: Object.freeze([]),
  [ESTADOS.CANCELADA]: Object.freeze([]),
});

/** Verifica se a transição de `atual` para `proximo` é permitida. */
export function transicaoPermitida(atual, proximo) {
  validarEstado(atual);
  validarEstado(proximo);
  return TRANSICOES_PERMITIDAS[atual].includes(proximo);
}

/** Garante a transição, lançando ErroTransicao se inválida. */
export function exigirTransicao(atual, proximo) {
  if (!transicaoPermitida(atual, proximo)) {
    throw new ErroTransicao(
      `Transição não permitida: "${ESTADOS_ROTULOS[atual]}" → "${ESTADOS_ROTULOS[proximo]}".`,
    );
  }
  return proximo;
}

/** Retorna true se a missão está em estado terminal (concluída ou cancelada). */
export function estadoTerminal(estado) {
  return estado === ESTADOS.CONCLUIDA || estado === ESTADOS.CANCELADA;
}

/** Verifica se a missão está atrasada (prazo passado e não terminal). */
export function estaAtrasada(estado, prazo) {
  if (!prazo || estadoTerminal(estado)) return false;
  return new Date(prazo).getTime() < Date.now();
}

/** Valida uma transição (lança ErroTransicao se inválida). */
export function validarTransicao(atual, proximo) {
  return exigirTransicao(atual, proximo);
}

/** Cria uma missão validada com valores padrão. */
export function criarMissao(dados) {
  const validada = validarMissaoCriacao(dados);
  return Object.freeze({
    titulo: validada.titulo,
    descricao: validada.descricao,
    estado: ESTADO_INICIAL,
    prioridade: validada.prioridade,
    prazo: validada.prazo,
  });
}

/** Converte uma linha do banco em objeto de missão (camelCase). */
export function paraMissao(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    titulo: linha.titulo,
    descricao: linha.descricao ?? null,
    estado: linha.estado,
    prioridade: linha.prioridade,
    prazo: linha.prazo ?? null,
    // Fase 07: projeto a que a missão pertence (null = sem projeto).
    projetoId: linha.projeto_id ?? null,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    iniciadaEm: linha.iniciada_em ?? null,
    concluidaEm: linha.concluida_em ?? null,
    canceladaEm: linha.cancelada_em ?? null,
  });
}
