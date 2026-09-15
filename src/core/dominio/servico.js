/**
 * PULSO — Domínio: Serviços (Fase 10.1 — Estrutura de Serviços)
 *
 * Um serviço representa uma obrigação, contratação ou despesa recorrente
 * (ou potencialmente recorrente) da vida do jogador: internet, energia,
 * água, aluguel, streaming, software…
 *
 * O serviço é a estrutura PERMANENTE; as futuras contas serão OCCORRÊNCIAS
 * desse serviço (Fase 10.2+). O valor esperado é apenas uma ESTIMATIVA de
 * custo — NÃO cria despesa, NÃO cria transação, NÃO altera saldo/carteira.
 *
 * Regras puras, sem E/S — nunca no renderer, nunca no SQL.
 * Valores SEMPRE em centavos (inteiro), nunca float/double.
 */

import { ErroValidacao, ErroTransicao } from '../erros.js';
import { validarValorCentavos } from './financa.js';

// ── Categorias do serviço (organização simples, texto controlado) ────────
// Decisão arquitetural (Fase 10.1): as categorias de serviço são uma lista
// controlada PRÓPRIA, separada das categorias financeiras da Fase 08.
// Categoria do serviço ≠ categoria financeira da transação: a tradução
// entre elas só fará sentido quando contas/despesas existirem (10.2+).
export const CATEGORIAS_SERVICO = Object.freeze([
  Object.freeze({ valor: 'moradia', rotulo: 'MORADIA' }),
  Object.freeze({ valor: 'contas', rotulo: 'CONTAS' }),
  Object.freeze({ valor: 'telecomunicacoes', rotulo: 'TELECOMUNICAÇÕES' }),
  Object.freeze({ valor: 'assinaturas', rotulo: 'ASSINATURAS' }),
  Object.freeze({ valor: 'tecnologia', rotulo: 'TECNOLOGIA' }),
  Object.freeze({ valor: 'educacao', rotulo: 'EDUCAÇÃO' }),
  Object.freeze({ valor: 'saude', rotulo: 'SAÚDE' }),
  Object.freeze({ valor: 'transporte', rotulo: 'TRANSPORTE' }),
  Object.freeze({ valor: 'lazer', rotulo: 'LAZER' }),
  Object.freeze({ valor: 'trabalho', rotulo: 'TRABALHO' }),
  Object.freeze({ valor: 'outros', rotulo: 'OUTROS' }),
]);

export const CATEGORIAS_SERVICO_VALORES = Object.freeze(
  CATEGORIAS_SERVICO.map((c) => c.valor),
);

export const ROTULO_CATEGORIA_SERVICO = Object.freeze(
  Object.fromEntries(CATEGORIAS_SERVICO.map((c) => [c.valor, c.rotulo])),
);

export function validarCategoriaServico(categoria) {
  if (!CATEGORIAS_SERVICO_VALORES.includes(categoria)) {
    throw new ErroValidacao(
      `Categoria inválida: ${String(categoria)}. Categorias: ${CATEGORIAS_SERVICO_VALORES.join(', ')}.`,
      'categoria',
    );
  }
  return categoria;
}

// ── Estados do serviço (máquina de estados da Fase 10.1) ─────────────────
export const ESTADOS_SERVICO = Object.freeze({
  ATIVO: 'ativo',
  INATIVO: 'inativo',
  ARQUIVADO: 'arquivado',
});

export const ESTADOS_SERVICO_ORDEM = Object.freeze([
  ESTADOS_SERVICO.ATIVO,
  ESTADOS_SERVICO.INATIVO,
  ESTADOS_SERVICO.ARQUIVADO,
]);

export const ESTADOS_SERVICO_ROTULOS = Object.freeze({
  [ESTADOS_SERVICO.ATIVO]: 'Ativo',
  [ESTADOS_SERVICO.INATIVO]: 'Inativo',
  [ESTADOS_SERVICO.ARQUIVADO]: 'Arquivado',
});

/** Serviço nasce ATIVO (seção 22: ao salvar, status = ATIVO). */
export const ESTADO_SERVICO_INICIAL = ESTADOS_SERVICO.ATIVO;

/**
 * Transições permitidas (seção 18):
 *   ATIVO → INATIVO | ARQUIVADO
 *   INATIVO → ATIVO | ARQUIVADO
 * ARQUIVADO é terminal nesta subfase (reativar arquivado fica para decisão
 * futura de arquitetura — seção 21).
 */
const TRANSICOES_SERVICO = Object.freeze({
  [ESTADOS_SERVICO.ATIVO]: Object.freeze([ESTADOS_SERVICO.INATIVO, ESTADOS_SERVICO.ARQUIVADO]),
  [ESTADOS_SERVICO.INATIVO]: Object.freeze([ESTADOS_SERVICO.ATIVO, ESTADOS_SERVICO.ARQUIVADO]),
  [ESTADOS_SERVICO.ARQUIVADO]: Object.freeze([]),
});

export function validarEstadoServico(estado) {
  if (!ESTADOS_SERVICO_ORDEM.includes(estado)) {
    throw new ErroValidacao(
      `Estado inválido: ${String(estado)}. Estados: ${ESTADOS_SERVICO_ORDEM.join(', ')}.`,
      'estado',
    );
  }
  return estado;
}

export function transicaoServicoPermitida(atual, proximo) {
  validarEstadoServico(atual);
  validarEstadoServico(proximo);
  return TRANSICOES_SERVICO[atual].includes(proximo);
}

export function exigirTransicaoServico(atual, proximo) {
  if (!transicaoServicoPermitida(atual, proximo)) {
    throw new ErroTransicao(
      `Transição de estado não permitida: ${ESTADOS_SERVICO_ROTULOS[atual]} → ${ESTADOS_SERVICO_ROTULOS[proximo]}.`,
    );
  }
}

/**
 * Estado encerrado: o serviço arquivado não aparece na lista operacional
 * padrão e permanece no banco como histórico (seção 18/20).
 */
export function servicoArquivado(estado) {
  return estado === ESTADOS_SERVICO.ARQUIVADO;
}

// ── Validações de campos ──────────────────────────────────────────────────
const TAM_NOME_MAX = 120;
const TAM_FORNECEDOR_MAX = 120;
const TAM_DESCRICAO_MAX = 2000;

export function validarNomeServico(nome) {
  if (typeof nome !== 'string') {
    throw new ErroValidacao('O nome do serviço é obrigatório.', 'nome');
  }
  const limpo = nome.trim();
  if (limpo.length === 0) {
    throw new ErroValidacao('O nome do serviço é obrigatório.', 'nome');
  }
  if (limpo.length > TAM_NOME_MAX) {
    throw new ErroValidacao(`O nome do serviço deve ter até ${TAM_NOME_MAX} caracteres.`, 'nome');
  }
  return limpo;
}

/** Fornecedor é texto livre opcional (seção 15 — sem entidade própria). */
export function validarFornecedorServico(fornecedor) {
  if (fornecedor === null || fornecedor === undefined) return null;
  if (typeof fornecedor !== 'string') {
    throw new ErroValidacao('O fornecedor deve ser um texto.', 'fornecedor');
  }
  const limpo = fornecedor.trim();
  if (limpo.length === 0) return null;
  if (limpo.length > TAM_FORNECEDOR_MAX) {
    throw new ErroValidacao(
      `O fornecedor deve ter até ${TAM_FORNECEDOR_MAX} caracteres.`,
      'fornecedor',
    );
  }
  return limpo;
}

/** Descrição é texto livre opcional (seção 16). */
export function validarDescricaoServico(descricao) {
  if (descricao === null || descricao === undefined) return null;
  if (typeof descricao !== 'string') {
    throw new ErroValidacao('A descrição deve ser um texto.', 'descricao');
  }
  const limpo = descricao.trim();
  if (limpo.length === 0) return null;
  if (limpo.length > TAM_DESCRICAO_MAX) {
    throw new ErroValidacao(
      `A descrição deve ter até ${TAM_DESCRICAO_MAX} caracteres.`,
      'descricao',
    );
  }
  return limpo;
}

/**
 * Valor esperado em CENTAVOS, inteiro e > 0 (seção 34).
 * Reusa o mecanismo monetário da FASE 08 — não há segunda implementação
 * de dinheiro. Zero/negativo/não-inteiro são rejeitados.
 */
export function validarValorEsperado(centavos) {
  const valor = validarValorCentavos(centavos);
  if (valor <= 0) {
    throw new ErroValidacao(
      'O valor esperado deve ser maior que zero (em centavos).',
      'valorEsperado',
    );
  }
  return valor;
}

// ── Validações de criação e edição ────────────────────────────────────────
export function validarServicoCriacao(dados) {
  const entrada = dados ?? {};
  return Object.freeze({
    nome: validarNomeServico(entrada.nome),
    fornecedor: validarFornecedorServico(entrada.fornecedor ?? null),
    categoria: validarCategoriaServico(entrada.categoria),
    descricao: validarDescricaoServico(entrada.descricao ?? null),
    valorEsperado: validarValorEsperado(
      entrada.valorEsperado ?? entrada.valorEsperadoCentavos ?? entrada.expectedAmount,
    ),
  });
}

/** Edição parcial: apenas campos presentes são validados e devolvidos. */
export function validarServicoEdicao(dados) {
  const entrada = dados ?? {};
  const resultado = {};
  if ('nome' in entrada) resultado.nome = validarNomeServico(entrada.nome);
  if ('fornecedor' in entrada) resultado.fornecedor = validarFornecedorServico(entrada.fornecedor);
  if ('categoria' in entrada) resultado.categoria = validarCategoriaServico(entrada.categoria);
  if ('descricao' in entrada) resultado.descricao = validarDescricaoServico(entrada.descricao);
  if ('valorEsperado' in entrada || 'valorEsperadoCentavos' in entrada || 'expectedAmount' in entrada) {
    resultado.valorEsperado = validarValorEsperado(
      entrada.valorEsperado ?? entrada.valorEsperadoCentavos ?? entrada.expectedAmount,
    );
  }
  return Object.freeze(resultado);
}

// ── Conversor linha → objeto (camelCase, congelado) ───────────────────────
export function paraServico(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    nome: linha.nome,
    fornecedor: linha.fornecedor ?? null,
    categoria: linha.categoria,
    descricao: linha.descricao ?? null,
    valorEsperado: linha.valor_esperado_centavos,
    estado: linha.estado,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    arquivadoEm: linha.arquivado_em ?? null,
  });
}
