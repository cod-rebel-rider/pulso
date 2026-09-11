/**
 * PULSO — Domínio: Projeto (Fase 07 — Projetos)
 *
 * Um projeto é uma direção: organiza várias missões em torno de um
 * objetivo maior. Regras puras, sem E/S — nunca no renderer, nunca no SQL.
 *
 * Conceito (docs/projeto.md): PROJETO → MISSÕES → AÇÕES.
 */

import { ErroValidacao, ErroTransicao } from '../erros.js';

// ── Estados ───────────────────────────────────────────────────────────
export const ESTADOS_PROJETO = Object.freeze({
  PLANEJADO: 'planejado',
  EM_ANDAMENTO: 'em_andamento',
  CONCLUIDO: 'concluido',
  CANCELADO: 'cancelado',
  ARQUIVADO: 'arquivado',
});

export const ESTADOS_PROJETO_ORDEM = Object.freeze([
  ESTADOS_PROJETO.PLANEJADO,
  ESTADOS_PROJETO.EM_ANDAMENTO,
  ESTADOS_PROJETO.CONCLUIDO,
  ESTADOS_PROJETO.CANCELADO,
  ESTADOS_PROJETO.ARQUIVADO,
]);

export const ESTADOS_PROJETO_ROTULOS = Object.freeze({
  [ESTADOS_PROJETO.PLANEJADO]: 'Planejado',
  [ESTADOS_PROJETO.EM_ANDAMENTO]: 'Em andamento',
  [ESTADOS_PROJETO.CONCLUIDO]: 'Concluído',
  [ESTADOS_PROJETO.CANCELADO]: 'Cancelado',
  [ESTADOS_PROJETO.ARQUIVADO]: 'Arquivado',
});

export const ESTADO_PROJETO_INICIAL = ESTADOS_PROJETO.PLANEJADO;

const TRANSICOES_PROJETO = Object.freeze({
  [ESTADOS_PROJETO.PLANEJADO]: Object.freeze([
    ESTADOS_PROJETO.EM_ANDAMENTO,
    ESTADOS_PROJETO.CANCELADO,
    ESTADOS_PROJETO.ARQUIVADO,
  ]),
  [ESTADOS_PROJETO.EM_ANDAMENTO]: Object.freeze([
    ESTADOS_PROJETO.CONCLUIDO,
    ESTADOS_PROJETO.CANCELADO,
    ESTADOS_PROJETO.ARQUIVADO,
  ]),
  [ESTADOS_PROJETO.CONCLUIDO]: Object.freeze([ESTADOS_PROJETO.ARQUIVADO]),
  [ESTADOS_PROJETO.CANCELADO]: Object.freeze([ESTADOS_PROJETO.ARQUIVADO]),
  [ESTADOS_PROJETO.ARQUIVADO]: Object.freeze([]),
});

/** Valida o estado do projeto. */
export function validarEstadoProjeto(estado) {
  if (!ESTADOS_PROJETO_ORDEM.includes(estado)) {
    throw new ErroValidacao(`Estado de projeto inválido: ${String(estado)}.`);
  }
  return estado;
}

/** Verifica se a transição de estado é permitida. */
export function transicaoProjetoPermitida(atual, proximo) {
  validarEstadoProjeto(atual);
  validarEstadoProjeto(proximo);
  return TRANSICOES_PROJETO[atual].includes(proximo);
}

/** Garante a transição, lançando ErroTransicao se inválida. */
export function exigirTransicaoProjeto(atual, proximo) {
  if (!transicaoProjetoPermitida(atual, proximo)) {
    throw new ErroTransicao(
      `Transição não permitida: "${ESTADOS_PROJETO_ROTULOS[atual]}" → "${ESTADOS_PROJETO_ROTULOS[proximo]}".`,
    );
  }
  return proximo;
}

/** Valida uma transição (lança ErroTransicao se inválida). */
export function validarTransicaoProjeto(atual, proximo) {
  return exigirTransicaoProjeto(atual, proximo);
}

/** Retorna true se o projeto está em fluxo ativo (planejado/em andamento). */
export function projetoAtivo(estado) {
  return estado === ESTADOS_PROJETO.PLANEJADO || estado === ESTADOS_PROJETO.EM_ANDAMENTO;
}

/** Verifica se o projeto está atrasado (prazo passado e ainda ativo). */
export function projetoAtrasado(estado, prazo) {
  if (!prazo || !projetoAtivo(estado)) return false;
  return new Date(prazo).getTime() < Date.now();
}

// ── Validação de campos (mesmos limites das missões: 120/2000) ─────────
export const TAMANHO_MAXIMO_PROJETO = Object.freeze({
  TITULO: 120,
  DESCRICAO: 2000,
});

function textoNaoVazio(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

/** Valida o título do projeto (obrigatório). */
export function validarTituloProjeto(titulo) {
  if (!textoNaoVazio(titulo)) {
    throw new ErroValidacao('O título do projeto é obrigatório.');
  }
  const aparado = titulo.trim();
  if (aparado.length > TAMANHO_MAXIMO_PROJETO.TITULO) {
    throw new ErroValidacao(`O título pode ter no máximo ${TAMANHO_MAXIMO_PROJETO.TITULO} caracteres.`);
  }
  return aparado;
}

/** Valida a descrição (opcional). */
export function validarDescricaoProjeto(descricao) {
  if (descricao === null || descricao === undefined || descricao === '') {
    return null;
  }
  if (typeof descricao !== 'string') {
    throw new ErroValidacao('A descrição deve ser um texto.');
  }
  const aparada = descricao.trim();
  if (aparada.length === 0) return null;
  if (aparada.length > TAMANHO_MAXIMO_PROJETO.DESCRICAO) {
    throw new ErroValidacao(`A descrição pode ter no máximo ${TAMANHO_MAXIMO_PROJETO.DESCRICAO} caracteres.`);
  }
  return aparada;
}

/** Valida a prioridade (mesmos valores das missões — sem duplicar conceito). */
export function validarPrioridadeProjeto(prioridade) {
  const validas = ['baixa', 'normal', 'alta', 'critica'];
  if (!validas.includes(prioridade)) {
    throw new ErroValidacao(`Prioridade inválida: ${String(prioridade)}.`);
  }
  return prioridade;
}

/** Valida o prazo (ISO válido ou null). */
export function validarPrazoProjeto(prazo) {
  if (prazo === null || prazo === undefined || prazo === '') {
    return null;
  }
  if (typeof prazo !== 'string') {
    throw new ErroValidacao('O prazo deve ser uma data em formato ISO.');
  }
  const momento = new Date(prazo).getTime();
  if (!Number.isFinite(momento)) {
    throw new ErroValidacao('O prazo deve ser uma data válida.');
  }
  return new Date(prazo).toISOString();
}

/** Valida dados de criação (status inicial sempre PLANEJADO). */
export function validarProjetoCriacao(dados) {
  return Object.freeze({
    titulo: validarTituloProjeto(dados.titulo),
    descricao: validarDescricaoProjeto(dados.descricao),
    prioridade: validarPrioridadeProjeto(dados.prioridade ?? 'normal'),
    prazo: validarPrazoProjeto(dados.prazo),
  });
}

/** Valida dados de edição (campos parciais; estado NUNCA por campo livre). */
export function validarProjetoEdicao(dados) {
  const resultado = {};
  if ('titulo' in dados) resultado.titulo = validarTituloProjeto(dados.titulo);
  if ('descricao' in dados) resultado.descricao = validarDescricaoProjeto(dados.descricao);
  if ('prioridade' in dados) resultado.prioridade = validarPrioridadeProjeto(dados.prioridade);
  if ('prazo' in dados) resultado.prazo = validarPrazoProjeto(dados.prazo);
  return Object.freeze(resultado);
}

/** Converte uma linha do banco em objeto de projeto (camelCase). */
export function paraProjeto(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    titulo: linha.titulo,
    descricao: linha.descricao ?? null,
    estado: linha.estado,
    prioridade: linha.prioridade,
    prazo: linha.prazo ?? null,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    iniciadaEm: linha.iniciada_em ?? null,
    concluidaEm: linha.concluida_em ?? null,
    canceladaEm: linha.cancelada_em ?? null,
  });
}

/**
 * Calcula o progresso do projeto a partir das missões associadas.
 * concluídas / total × 100. Sem missões → 0% (nunca 100% automático).
 */
export function calcularProgressoProjeto(missoes) {
  const total = missoes.length;
  if (total === 0) return 0;
  const concluidas = missoes.filter((m) => m.estado === 'concluida').length;
  return Math.round((concluidas / total) * 10000) / 100;
}

