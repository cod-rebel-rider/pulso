/**
 * PULSO — Dominio: Loja / Lista de Desejos (Fase 09)
 *
 * Um desejo e planejamento — NAO gasta dinheiro, NAO cria transacao,
 * NAO altera saldo/orcamento/XP. Apenas a COMPRA gera uma despesa
 * via o motor financeiro da Fase 08.
 *
 * Regras puras, sem E/S — nunca no renderer, nunca no SQL.
 * Valores SEMPRE em centavos (inteiro), nunca float/double.
 */

import { ErroValidacao, ErroTransicao } from '../erros.js';
import { validarValorCentavos as validarCentavosFinanca } from './financa.js';

// ── Categorias do desejo (organizacao simples, texto controlado) ──────────
export const CATEGORIAS_DESEJO = Object.freeze([
  Object.freeze({ valor: 'tecnologia', rotulo: 'TECNOLOGIA' }),
  Object.freeze({ valor: 'musica', rotulo: 'MUSICA' }),
  Object.freeze({ valor: 'vestuario', rotulo: 'VESTUARIO' }),
  Object.freeze({ valor: 'casa', rotulo: 'CASA' }),
  Object.freeze({ valor: 'transporte', rotulo: 'TRANSPORTE' }),
  Object.freeze({ valor: 'educacao', rotulo: 'EDUCACAO' }),
  Object.freeze({ valor: 'lazer', rotulo: 'LAZER' }),
  Object.freeze({ valor: 'trabalho', rotulo: 'TRABALHO' }),
  Object.freeze({ valor: 'hobby', rotulo: 'HOBBY' }),
  Object.freeze({ valor: 'outros', rotulo: 'OUTROS' }),
]);

export const CATEGORIAS_DESEJO_VALORES = Object.freeze(
  CATEGORIAS_DESEJO.map((c) => c.valor),
);

export const ROTULO_CATEGORIA_DESEJO = Object.freeze(
  Object.fromEntries(CATEGORIAS_DESEJO.map((c) => [c.valor, c.rotulo])),
);

export function validarCategoriaDesejo(categoria) {
  if (!CATEGORIAS_DESEJO_VALORES.includes(categoria)) {
    throw new ErroValidacao(
      `Categoria invalida: ${String(categoria)}. Categorias: ${CATEGORIAS_DESEJO_VALORES.join(', ')}.`,
      'categoria',
    );
  }
  return categoria;
}

// ── Prioridades (mesmo vocabulario das missoes/projetos) ──────────────────
export const PRIORIDADES_DESEJO = Object.freeze({
  BAIXA: 'baixa',
  NORMAL: 'normal',
  ALTA: 'alta',
  CRITICA: 'critica',
});

export const PRIORIDADES_DESEJO_ORDEM = Object.freeze([
  PRIORIDADES_DESEJO.BAIXA,
  PRIORIDADES_DESEJO.NORMAL,
  PRIORIDADES_DESEJO.ALTA,
  PRIORIDADES_DESEJO.CRITICA,
]);

export const PRIORIDADES_DESEJO_ROTULOS = Object.freeze({
  [PRIORIDADES_DESEJO.BAIXA]: 'Baixa',
  [PRIORIDADES_DESEJO.NORMAL]: 'Normal',
  [PRIORIDADES_DESEJO.ALTA]: 'Alta',
  [PRIORIDADES_DESEJO.CRITICA]: 'Critica',
});

export const PRIORIDADE_DESEJO_PADRAO = PRIORIDADES_DESEJO.NORMAL;

export function validarPrioridadeDesejo(prioridade) {
  if (!PRIORIDADES_DESEJO_ORDEM.includes(prioridade)) {
    throw new ErroValidacao(`Prioridade invalida: ${String(prioridade)}.`, 'prioridade');
  }
  return prioridade;
}

// ── Estados (maquina de estados da Fase 09) ───────────────────────────────
export const ESTADOS_DESEJO = Object.freeze({
  DESEJADO: 'desejado',
  EM_ANALISE: 'em_analise',
  PLANEJADO: 'planejado',
  COMPRADO: 'comprado',
  CANCELADO: 'cancelado',
});

export const ESTADOS_DESEJO_ORDEM = Object.freeze([
  ESTADOS_DESEJO.DESEJADO,
  ESTADOS_DESEJO.EM_ANALISE,
  ESTADOS_DESEJO.PLANEJADO,
  ESTADOS_DESEJO.COMPRADO,
  ESTADOS_DESEJO.CANCELADO,
]);

export const ESTADOS_DESEJO_ROTULOS = Object.freeze({
  [ESTADOS_DESEJO.DESEJADO]: 'Desejado',
  [ESTADOS_DESEJO.EM_ANALISE]: 'Em analise',
  [ESTADOS_DESEJO.PLANEJADO]: 'Planejado',
  [ESTADOS_DESEJO.COMPRADO]: 'Comprado',
  [ESTADOS_DESEJO.CANCELADO]: 'Cancelado',
});

export const ESTADO_DESEJO_INICIAL = ESTADOS_DESEJO.DESEJADO;

const TRANSICOES_DESEJO = Object.freeze({
  [ESTADOS_DESEJO.DESEJADO]: Object.freeze([ESTADOS_DESEJO.EM_ANALISE, ESTADOS_DESEJO.CANCELADO]),
  [ESTADOS_DESEJO.EM_ANALISE]: Object.freeze([ESTADOS_DESEJO.PLANEJADO, ESTADOS_DESEJO.CANCELADO]),
  [ESTADOS_DESEJO.PLANEJADO]: Object.freeze([ESTADOS_DESEJO.COMPRADO, ESTADOS_DESEJO.CANCELADO]),
  [ESTADOS_DESEJO.COMPRADO]: Object.freeze([]),
  [ESTADOS_DESEJO.CANCELADO]: Object.freeze([]),
});

export function validarEstadoDesejo(estado) {
  if (!ESTADOS_DESEJO_ORDEM.includes(estado)) {
    throw new ErroValidacao(`Estado de desejo invalido: ${String(estado)}.`, 'estado');
  }
  return estado;
}

export function transicaoDesejoPermitida(atual, proximo) {
  validarEstadoDesejo(atual);
  validarEstadoDesejo(proximo);
  return TRANSICOES_DESEJO[atual].includes(proximo);
}

export function exigirTransicaoDesejo(atual, proximo) {
  if (!transicaoDesejoPermitida(atual, proximo)) {
    throw new ErroTransicao(
      `Transicao nao permitida: "${ESTADOS_DESEJO_ROTULOS[atual]}" -> "${ESTADOS_DESEJO_ROTULOS[proximo]}".`,
    );
  }
  return proximo;
}

export function desejoFinal(estado) {
  return estado === ESTADOS_DESEJO.COMPRADO || estado === ESTADOS_DESEJO.CANCELADO;
}

export function desejoAtivo(estado) {
  return (
    estado === ESTADOS_DESEJO.DESEJADO ||
    estado === ESTADOS_DESEJO.EM_ANALISE ||
    estado === ESTADOS_DESEJO.PLANEJADO
  );
}

// ── Validacao de campos ───────────────────────────────────────────────────
export const TAMANHO_MAXIMO_DESEJO = Object.freeze({
  TITULO: 120,
  DESCRICAO: 2000,
  OBSERVACAO_COMPRA: 500,
});

function textoNaoVazio(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

export function validarTituloDesejo(titulo) {
  if (!textoNaoVazio(titulo)) {
    throw new ErroValidacao('O nome do item e obrigatorio.', 'titulo');
  }
  const aparado = titulo.trim();
  if (aparado.length > TAMANHO_MAXIMO_DESEJO.TITULO) {
    throw new ErroValidacao(
      `O nome pode ter no maximo ${TAMANHO_MAXIMO_DESEJO.TITULO} caracteres.`,
      'titulo',
    );
  }
  return aparado;
}

export function validarDescricaoDesejo(descricao) {
  if (descricao === null || descricao === undefined || descricao === '') return null;
  if (typeof descricao !== 'string') {
    throw new ErroValidacao('A descricao deve ser um texto.', 'descricao');
  }
  const aparada = descricao.trim();
  if (aparada.length === 0) return null;
  if (aparada.length > TAMANHO_MAXIMO_DESEJO.DESCRICAO) {
    throw new ErroValidacao(
      `A descricao pode ter no maximo ${TAMANHO_MAXIMO_DESEJO.DESCRICAO} caracteres.`,
      'descricao',
    );
  }
  return aparada;
}

export function validarPrecoEsperado(valorCentavos) {
  try {
    return validarCentavosFinanca(valorCentavos);
  } catch {
    throw new ErroValidacao('O preco esperado deve ser maior que zero (em centavos).', 'precoEsperado');
  }
}

export function validarPrecoFinal(valorCentavos) {
  try {
    return validarCentavosFinanca(valorCentavos);
  } catch {
    throw new ErroValidacao('O preco final deve ser maior que zero (em centavos).', 'precoFinal');
  }
}

export function validarObservacaoCompra(observacao) {
  if (observacao === null || observacao === undefined || observacao === '') return null;
  if (typeof observacao !== 'string') {
    throw new ErroValidacao('A observacao deve ser um texto.', 'observacao');
  }
  const aparada = observacao.trim();
  if (aparada.length === 0) return null;
  if (aparada.length > TAMANHO_MAXIMO_DESEJO.OBSERVACAO_COMPRA) {
    throw new ErroValidacao(
      `A observacao pode ter no maximo ${TAMANHO_MAXIMO_DESEJO.OBSERVACAO_COMPRA} caracteres.`,
      'observacao',
    );
  }
  return aparada;
}

export function validarDataCompra(data) {
  if (data === null || data === undefined || data === '') return null;
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new ErroValidacao('A data da compra deve estar no formato AAAA-MM-DD.', 'data');
  }
  const momento = new Date(`${data}T12:00:00Z`).getTime();
  if (!Number.isFinite(momento)) {
    throw new ErroValidacao('A data da compra deve ser uma data valida.', 'data');
  }
  return data;
}

export function dataHoje() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function validarDesejoCriacao(dados) {
  const entrada = dados ?? {};
  return Object.freeze({
    titulo: validarTituloDesejo(entrada.titulo),
    descricao: validarDescricaoDesejo(entrada.descricao ?? null),
    categoria: validarCategoriaDesejo(entrada.categoria),
    prioridade: validarPrioridadeDesejo(entrada.prioridade ?? PRIORIDADE_DESEJO_PADRAO),
    precoEsperado: validarPrecoEsperado(
      entrada.precoEsperado ?? entrada.valorEsperadoCentavos ?? entrada.expectedAmount,
    ),
  });
}

export function validarDesejoEdicao(dados) {
  const entrada = dados ?? {};
  const resultado = {};
  if ('titulo' in entrada) resultado.titulo = validarTituloDesejo(entrada.titulo);
  if ('descricao' in entrada) resultado.descricao = validarDescricaoDesejo(entrada.descricao);
  if ('categoria' in entrada) resultado.categoria = validarCategoriaDesejo(entrada.categoria);
  if ('prioridade' in entrada) resultado.prioridade = validarPrioridadeDesejo(entrada.prioridade);
  if ('precoEsperado' in entrada || 'valorEsperadoCentavos' in entrada || 'expectedAmount' in entrada) {
    resultado.precoEsperado = validarPrecoEsperado(
      entrada.precoEsperado ?? entrada.valorEsperadoCentavos ?? entrada.expectedAmount,
    );
  }
  return Object.freeze(resultado);
}

export function validarCompraDesejo(dados) {
  const entrada = dados ?? {};
  const precoFinal = entrada.precoFinal ?? entrada.valorPagoCentavos ?? entrada.finalAmount;
  return Object.freeze({
    precoFinal: validarPrecoFinal(precoFinal),
    data: validarDataCompra(entrada.data ?? null) ?? dataHoje(),
    observacao: validarObservacaoCompra(entrada.observacao ?? null),
  });
}

export function calcularDiferencaCompra(precoEsperado, precoFinal) {
  validarPrecoEsperado(precoEsperado);
  validarPrecoFinal(precoFinal);
  const diferencaCentavos = precoFinal - precoEsperado;
  const percentual = Math.round((diferencaCentavos / precoEsperado) * 10000) / 100;
  return Object.freeze({ diferencaCentavos, percentual });
}

export const MAPA_CATEGORIA_FINANCEIRA = Object.freeze({
  tecnologia: 'tecnologia',
  musica: 'musica',
  vestuario: 'compras',
  casa: 'moradia',
  transporte: 'transporte',
  educacao: 'educacao',
  lazer: 'lazer',
  trabalho: 'outra_despesa',
  hobby: 'lazer',
  outros: 'compras',
});

export function categoriaFinanceiraDoDesejo(categoria) {
  validarCategoriaDesejo(categoria);
  return MAPA_CATEGORIA_FINANCEIRA[categoria];
}

export function descricaoTransacaoCompra(titulo) {
  return `Compra: ${validarTituloDesejo(titulo)}`;
}

export function paraDesejo(linha) {
  if (!linha) return null;
  const esperado = linha.valor_esperado_centavos;
  const pago = linha.valor_pago_centavos ?? null;
  const diferenca = linha.diferenca_centavos ?? (pago !== null ? pago - esperado : null);
  const percentual =
    pago !== null && esperado > 0
      ? Math.round(((pago - esperado) / esperado) * 10000) / 100
      : null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    titulo: linha.titulo,
    descricao: linha.descricao ?? null,
    categoria: linha.categoria,
    prioridade: linha.prioridade,
    estado: linha.estado,
    precoEsperado: esperado,
    precoFinal: pago,
    diferencaCentavos: diferenca,
    percentual,
    dataCompra: linha.data_compra ?? null,
    observacaoCompra: linha.observacao_compra ?? null,
    transacaoId: linha.transacao_id ?? null,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    compradoEm: linha.comprado_em ?? null,
  });
}

