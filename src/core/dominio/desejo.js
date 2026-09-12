/**
 * PULSO — Domínio: Desejos / Lista de Desejos (Fase 09 — Loja / Lista de Desejos)
 *
 * Camada de decisão de consumo: "EU QUERO" versus "EU COMPREI".
 * Regras puras, sem E/S — nunca no renderer, nunca no SQL.
 *
 * Princípios:
 * - o desejo NÃO gasta dinheiro: só a compra gasta, e sempre via transação
 *   de despesa do motor financeiro da FASE 08 (nunca saldo editado);
 * - valores SEMPRE em centavos (inteiro positivo) — reutiliza as regras de
 *   dinheiro de dominio/financa.js (fonte única, sem duplicação);
 * - preço esperado é planejamento; preço final é realidade;
 * - estados terminais (comprado, cancelado) são permanentes nesta fase;
 * - COMPRADO só é alcançado pelo fluxo de compra (que cria a transação) —
 *   nunca por mudança arbitrária de estado.
 */

import {
  validarValorCentavos,
  validarData,
  TAMANHO_MAXIMO_DESCRICAO,
} from './financa.js';
import { ErroValidacao } from '../erros.js';

// ── Estados do desejo ────────────────────────────────────────────────────
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
  [ESTADOS_DESEJO.EM_ANALISE]: 'Em análise',
  [ESTADOS_DESEJO.PLANEJADO]: 'Planejado',
  [ESTADOS_DESEJO.COMPRADO]: 'Comprado',
  [ESTADOS_DESEJO.CANCELADO]: 'Cancelado',
});

/** Estados que representam decisão ainda em aberto (não terminais). */
export const ESTADOS_ATIVOS_DESEJO = Object.freeze([
  ESTADOS_DESEJO.DESEJADO,
  ESTADOS_DESEJO.EM_ANALISE,
  ESTADOS_DESEJO.PLANEJADO,
]);

/** Valida o estado (código canônico). */
export function validarEstadoDesejo(estado) {
  if (!ESTADOS_DESEJO_ORDEM.includes(estado)) {
    throw new ErroValidacao(
      `Estado de desejo inválido: ${String(estado)}. Estados: ${ESTADOS_DESEJO_ORDEM.join(', ')}.`,
      'estado',
    );
  }
  return estado;
}

/**
 * Valida a transição de estado. Regras (docs/desejo.md):
 * - estados ativos podem mover-se livremente entre si (decisão em aberto);
 * - ativo → cancelado é permitido (abandono preserva o histórico);
 * - estados terminais (comprado, cancelado) NÃO saem de onde estão;
 * - → comprado NUNCA por esta via: a única porta é `comprar`, que cria a
 *   transação financeira atômica (mudança de estado sem transação é inválida).
 */
export function validarTransicaoEstado(de, para) {
  const origem = validarEstadoDesejo(de);
  const destino = validarEstadoDesejo(para);
  if (origem === destino) {
    return destino; // reafirmação do mesmo estado é inócua e permitida
  }
  if (!ESTADOS_ATIVOS_DESEJO.includes(origem)) {
    throw new ErroValidacao(
      `Desejo ${ESTADOS_DESEJO_ROTULOS[origem]} é definitivo nesta fase e não pode mudar de estado.`,
      'estado',
    );
  }
  if (destino === ESTADOS_DESEJO.COMPRADO) {
    throw new ErroValidacao(
      'Use o registro de compra para marcar um desejo como comprado (a compra cria a transação financeira).',
      'estado',
    );
  }
  return destino;
}

/** Um desejo só pode ser comprado enquanto a decisão está em aberto. */
export function podeRegistrarCompra(estado) {
  return ESTADOS_ATIVOS_DESEJO.includes(validarEstadoDesejo(estado));
}

// ── Prioridades (organização — não altera dinheiro nem XP) ───────────────
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
  [PRIORIDADES_DESEJO.CRITICA]: 'Crítica',
});

export function validarPrioridadeDesejo(prioridade) {
  if (!PRIORIDADES_DESEJO_ORDEM.includes(prioridade)) {
    throw new ErroValidacao(
      `Prioridade inválida: ${String(prioridade)}. Prioridades: ${PRIORIDADES_DESEJO_ORDEM.join(', ')}.`,
      'prioridade',
    );
  }
  return prioridade;
}

// ── Categorias de itens (organização — separadas das financeiras) ────────
export const CATEGORIAS_DESEJO = Object.freeze([
  Object.freeze({ valor: 'tecnologia', rotulo: 'TECNOLOGIA' }),
  Object.freeze({ valor: 'musica', rotulo: 'MÚSICA' }),
  Object.freeze({ valor: 'vestuario', rotulo: 'VESTUÁRIO' }),
  Object.freeze({ valor: 'casa', rotulo: 'CASA' }),
  Object.freeze({ valor: 'transporte', rotulo: 'TRANSPORTE' }),
  Object.freeze({ valor: 'educacao', rotulo: 'EDUCAÇÃO' }),
  Object.freeze({ valor: 'lazer', rotulo: 'LAZER' }),
  Object.freeze({ valor: 'trabalho', rotulo: 'TRABALHO' }),
  Object.freeze({ valor: 'hobby', rotulo: 'HOBBY' }),
  Object.freeze({ valor: 'outros', rotulo: 'OUTROS' }),
]);

export function validarCategoriaDesejo(categoria) {
  const encontrada = CATEGORIAS_DESEJO.find((c) => c.valor === categoria);
  if (!encontrada) {
    throw new ErroValidacao(
      `Categoria de desejo inválida: ${String(categoria)}. Categorias: ${CATEGORIAS_DESEJO.map((c) => c.valor).join(', ')}.`,
      'categoria',
    );
  }
  return encontrada.valor;
}

/**
 * Mapeamento desejo → categoria financeira de DESPESA (Fase 08).
 * A compra reutiliza as categorias existentes do motor financeiro — nunca
 * cria um segundo sistema de categorias. Itens são bens adquiridos:
 * categorias sem despesa natural caem em `compras`; `hobby` em `lazer`.
 * Orçamentos da FASE 08 continuam válidos: a despesa entra na categoria
 * mapeada e é acompanhada automaticamente.
 */
export const MAPA_CATEGORIA_FINANCEIRA = Object.freeze({
  tecnologia: 'tecnologia',
  musica: 'musica',
  vestuario: 'compras',
  casa: 'compras',
  transporte: 'transporte',
  educacao: 'educacao',
  lazer: 'lazer',
  trabalho: 'compras',
  hobby: 'lazer',
  outros: 'outra_despesa',
});

/** Categoria financeira da despesa gerada pela compra (sempre definida). */
export function categoriaFinanceiraDaCompra(categoria) {
  return MAPA_CATEGORIA_FINANCEIRA[validarCategoriaDesejo(categoria)] ?? 'outra_despesa';
}

// ── Campos textuais ──────────────────────────────────────────────────────
export const TAMANHO_MAXIMO_TITULO = 120;
export const TAMANHO_MAXIMO_DESCRICAO_DESEJO = 500;

export function validarTituloDesejo(titulo) {
  if (typeof titulo !== 'string' || titulo.trim().length === 0) {
    throw new ErroValidacao('O nome do desejo é obrigatório.', 'titulo');
  }
  const aparado = titulo.trim();
  if (aparado.length > TAMANHO_MAXIMO_TITULO) {
    throw new ErroValidacao(
      `O nome pode ter no máximo ${TAMANHO_MAXIMO_TITULO} caracteres.`,
      'titulo',
    );
  }
  return aparado;
}

export function validarDescricaoDesejo(descricao) {
  if (descricao === null || descricao === undefined || descricao === '') return null;
  if (typeof descricao !== 'string') {
    throw new ErroValidacao('A descrição deve ser um texto.', 'descricao');
  }
  const aparada = descricao.trim();
  if (aparada.length === 0) return null;
  if (aparada.length > TAMANHO_MAXIMO_DESCRICAO_DESEJO) {
    throw new ErroValidacao(
      `A descrição pode ter no máximo ${TAMANHO_MAXIMO_DESCRICAO_DESEJO} caracteres.`,
      'descricao',
    );
  }
  return aparada;
}

/** Validação opcional da observação da compra (vira contexto da transação). */
export function validarObservacaoCompra(observacao) {
  if (observacao === null || observacao === undefined || observacao === '') return null;
  if (typeof observacao !== 'string') {
    throw new ErroValidacao('A observação deve ser um texto.', 'observacao');
  }
  const aparada = observacao.trim();
  if (aparada.length === 0) return null;
  if (aparada.length > TAMANHO_MAXIMO_DESCRICAO) {
    throw new ErroValidacao(
      `A observação pode ter no máximo ${TAMANHO_MAXIMO_DESCRICAO} caracteres.`,
      'observacao',
    );
  }
  return aparada;
}

// ── Validações de alto nível ─────────────────────────────────────────────
/**
 * Valida os dados de criação/edição de um desejo.
 * O preço esperado é planejamento: obrigatório, positivo, em centavos.
 */
export function validarDesejoCriacao(dados) {
  return Object.freeze({
    titulo: validarTituloDesejo(dados?.titulo),
    descricao: validarDescricaoDesejo(dados?.descricao),
    categoria: validarCategoriaDesejo(dados?.categoria),
    prioridade: validarPrioridadeDesejo(dados?.prioridade),
    valorEsperadoCentavos: validarValorCentavos(dados?.valorEsperadoCentavos),
  });
}

/** Valida os dados do registro de compra (preço final é realidade). */
export function validarCompra(dados) {
  return Object.freeze({
    valorFinalCentavos: validarValorCentavos(dados?.valorFinalCentavos),
    data: validarData(dados?.data),
    observacao: validarObservacaoCompra(dados?.observacao),
  });
}

/**
 * Monta a descrição da transação financeira da compra — o histórico da
 * FASE 08 precisa continuar compreensível ("de onde veio a despesa?").
 * Excedente de observação é truncado, nunca rejeitado, para não bloquear
 * uma compra por causa de contexto opcional.
 */
export function montarDescricaoTransacao(titulo, observacao = null) {
  let texto = `Compra: ${validarTituloDesejo(titulo)}`;
  if (observacao) texto += ` — ${observacao}`;
  return texto.length > TAMANHO_MAXIMO_DESCRICAO
    ? texto.slice(0, TAMANHO_MAXIMO_DESCRICAO)
    : texto;
}

// ── Comparação esperado × real ───────────────────────────────────────────
/**
 * Compara preço esperado (planejamento) com preço final (realidade).
 * diferencaCentavos = final - esperado (negativo = economia).
 * percentual = diferença / esperado × 100 (arredondado a 2 casas).
 * O esperado é sempre > 0 (validação), então o percentual é sempre definido;
 * defesa: esperado inválido → percentual 0.
 * @returns {{ diferencaCentavos: number, percentual: number, economizou: boolean, economiaCentavos: number }}
 */
export function calcularComparacao(valorEsperadoCentavos, valorFinalCentavos) {
  validarValorCentavos(valorEsperadoCentavos);
  validarValorCentavos(valorFinalCentavos);
  const diferencaCentavos = valorFinalCentavos - valorEsperadoCentavos;
  const percentual = valorEsperadoCentavos > 0
    ? Math.round((diferencaCentavos / valorEsperadoCentavos) * 10000) / 100
    : 0;
  return Object.freeze({
    diferencaCentavos,
    percentual,
    economizou: diferencaCentavos < 0,
    economiaCentavos: Math.max(0, -diferencaCentavos),
  });
}

// ── Resumo da lista (indicadores simples, derivados dos dados) ───────────
/**
 * @param {Array<{estado: string, valorEsperadoCentavos: number, valorFinalCentavos?: number|null}>} itens
 * @returns {{ ativos: number, planejados: number, comprados: number, cancelados: number, valorEstimadoCentavos: number, economiaCentavos: number }}
 */
export function resumirDesejos(itens) {
  let ativos = 0;
  let planejados = 0;
  let comprados = 0;
  let cancelados = 0;
  let valorEstimadoCentavos = 0;
  let economiaCentavos = 0;
  for (const item of itens) {
    if (ESTADOS_ATIVOS_DESEJO.includes(item.estado)) {
      ativos += 1;
      valorEstimadoCentavos += item.valorEsperadoCentavos;
      if (item.estado === ESTADOS_DESEJO.PLANEJADO) planejados += 1;
    } else if (item.estado === ESTADOS_DESEJO.COMPRADO) {
      comprados += 1;
      if (item.valorFinalCentavos !== null && item.valorFinalCentavos !== undefined) {
        economiaCentavos += Math.max(0, item.valorEsperadoCentavos - item.valorFinalCentavos);
      }
    } else if (item.estado === ESTADOS_DESEJO.CANCELADO) {
      cancelados += 1;
    }
  }
  return Object.freeze({
    ativos,
    planejados,
    comprados,
    cancelados,
    valorEstimadoCentavos,
    economiaCentavos,
  });
}

// ── Conversor linha → objeto (camelCase, congelado) ──────────────────────
export function paraDesejo(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    titulo: linha.titulo,
    descricao: linha.descricao ?? null,
    categoria: linha.categoria,
    prioridade: linha.prioridade,
    estado: linha.estado,
    valorEsperadoCentavos: linha.valor_esperado_centavos,
    valorFinalCentavos: linha.valor_final_centavos ?? null,
    compradoEm: linha.comprado_em ?? null,
    transacaoId: linha.transacao_id ?? null,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  });
}

