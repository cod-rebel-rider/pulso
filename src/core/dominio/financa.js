/**
 * PULSO — Domínio: Finanças (Fase 08 — Finanças)
 *
 * Núcleo financeiro do PULSO. Regras puras, sem E/S — nunca no renderer,
 * nunca no SQL.
 *
 * Princípios:
 * - valores SEMPRE em centavos (inteiro) — nunca float/double;
 * - saldo = consequência das transações confirmadas (nunca valor editado);
 * - categorias separadas por tipo (receita ≠ despesa);
 * - orçamento é planejamento — não cria dinheiro, não altera saldo;
 * - saldo negativo é permitido e apenas indicado (sem punição de RPG).
 */

import { ErroValidacao } from '../erros.js';

// ── Moeda (configuração central — evita espalhar "BRL" pelo código) ──────
export const MOEDA = 'BRL';
export const NOME_CARTEIRA_PRINCIPAL = 'Carteira Principal';

// ── Tipos de transação ───────────────────────────────────────────────────
// Arquitetura preparada para TRANSFERÊNCIA em fase futura (não implementada).
export const TIPOS_TRANSACAO = Object.freeze({
  RECEITA: 'receita',
  DESPESA: 'despesa',
});

export const TIPOS_TRANSACAO_ORDEM = Object.freeze([
  TIPOS_TRANSACAO.RECEITA,
  TIPOS_TRANSACAO.DESPESA,
]);

export const TIPOS_TRANSACAO_ROTULOS = Object.freeze({
  [TIPOS_TRANSACAO.RECEITA]: 'Receita',
  [TIPOS_TRANSACAO.DESPESA]: 'Despesa',
});

/** Valida o tipo da transação (código canônico). */
export function validarTipoTransacao(tipo) {
  if (!TIPOS_TRANSACAO_ORDEM.includes(tipo)) {
    throw new ErroValidacao(
      `Tipo de transação inválido: ${String(tipo)}. Tipos: ${TIPOS_TRANSACAO_ORDEM.join(', ')}.`,
      'tipo',
    );
  }
  return tipo;
}

// ── Categorias financeiras (separadas por tipo) ──────────────────────────
export const CATEGORIAS_RECEITA = Object.freeze([
  Object.freeze({ valor: 'salario', rotulo: 'SALÁRIO' }),
  Object.freeze({ valor: 'freelance', rotulo: 'FREELANCE' }),
  Object.freeze({ valor: 'missao', rotulo: 'MISSÃO' }),
  Object.freeze({ valor: 'venda', rotulo: 'VENDA' }),
  Object.freeze({ valor: 'reembolso', rotulo: 'REEMBOLSO' }),
  Object.freeze({ valor: 'saldo_inicial', rotulo: 'SALDO INICIAL' }),
  Object.freeze({ valor: 'outra_receita', rotulo: 'OUTRA RECEITA' }),
]);

export const CATEGORIAS_DESPESA = Object.freeze([
  Object.freeze({ valor: 'alimentacao', rotulo: 'ALIMENTAÇÃO' }),
  Object.freeze({ valor: 'transporte', rotulo: 'TRANSPORTE' }),
  Object.freeze({ valor: 'moradia', rotulo: 'MORADIA' }),
  Object.freeze({ valor: 'contas', rotulo: 'CONTAS' }),
  Object.freeze({ valor: 'assinaturas', rotulo: 'ASSINATURAS' }),
  Object.freeze({ valor: 'lazer', rotulo: 'LAZER' }),
  Object.freeze({ valor: 'tecnologia', rotulo: 'TECNOLOGIA' }),
  Object.freeze({ valor: 'musica', rotulo: 'MÚSICA' }),
  Object.freeze({ valor: 'saude', rotulo: 'SAÚDE' }),
  Object.freeze({ valor: 'educacao', rotulo: 'EDUCAÇÃO' }),
  Object.freeze({ valor: 'compras', rotulo: 'COMPRAS' }),
  Object.freeze({ valor: 'outra_despesa', rotulo: 'OUTRA DESPESA' }),
]);

export const CATEGORIAS_POR_TIPO = Object.freeze({
  [TIPOS_TRANSACAO.RECEITA]: CATEGORIAS_RECEITA,
  [TIPOS_TRANSACAO.DESPESA]: CATEGORIAS_DESPESA,
});

export const ROTULO_CATEGORIA = Object.freeze(
  Object.fromEntries(
    [...CATEGORIAS_RECEITA, ...CATEGORIAS_DESPESA].map((c) => [c.valor, c.rotulo]),
  ),
);

/** Valida a categoria contra o tipo — rejeita combinação incompatível. */
export function validarCategoria(categoria, tipo) {
  const tipoValidado = validarTipoTransacao(tipo);
  const lista = CATEGORIAS_POR_TIPO[tipoValidado];
  const encontrada = lista.find((c) => c.valor === categoria);
  if (!encontrada) {
    const rotuloTipo = TIPOS_TRANSACAO_ROTULOS[tipoValidado];
    throw new ErroValidacao(
      `Categoria inválida para ${rotuloTipo}: "${String(categoria)}".`,
      'categoria',
    );
  }
  return encontrada.valor;
}

// ── Valores (precisão monetária em centavos) ─────────────────────────────
/**
 * Valida um valor em centavos: inteiro positivo (nunca 0, nunca negativo).
 * O sentido (receita aumenta / despesa reduz) é dado pelo tipo, nunca pelo sinal.
 */
export function validarValorCentavos(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || !Number.isInteger(valor)) {
    throw new ErroValidacao('O valor deve ser um número inteiro (em centavos).', 'valor');
  }
  if (valor <= 0) {
    throw new ErroValidacao('O valor da transação deve ser maior que zero (R$ 0,01).', 'valor');
  }
  return valor;
}

// ── Descrição (contextualização opcional) ────────────────────────────────
export const TAMANHO_MAXIMO_DESCRICAO = 120;

export function validarDescricao(descricao) {
  if (descricao === null || descricao === undefined || descricao === '') return null;
  if (typeof descricao !== 'string') {
    throw new ErroValidacao('A descrição deve ser um texto.', 'descricao');
  }
  const aparada = descricao.trim();
  if (aparada.length === 0) return null;
  if (aparada.length > TAMANHO_MAXIMO_DESCRICAO) {
    throw new ErroValidacao(
      `A descrição pode ter no máximo ${TAMANHO_MAXIMO_DESCRICAO} caracteres.`,
      'descricao',
    );
  }
  return aparada;
}
// ── Datas ────────────────────────────────────────────────────────────────
/**
 * Valida uma data e normaliza para 'YYYY-MM-DD' (dia). Transações no PULSO
 * são orientadas a dia; o horário não faz parte do modelo desta fase.
 * Rejeita datas inválidas de calendário (ex.: 2026-02-31).
 */
export function validarData(data) {
  if (typeof data !== 'string' || data.trim() === '') {
    throw new ErroValidacao('A data é obrigatória.', 'data');
  }
  const texto = data.trim();
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(texto);
  const momento = new Date(texto).getTime();
  if (!Number.isFinite(momento)) {
    throw new ErroValidacao('A data é inválida.', 'data');
  }
  if (soData) {
    const [ano, mes, dia] = texto.split('-').map(Number);
    const checagem = new Date(Date.UTC(ano, mes - 1, dia));
    const diaValido =
      checagem.getUTCFullYear() === ano &&
      checagem.getUTCMonth() === mes - 1 &&
      checagem.getUTCDate() === dia;
    if (!diaValido) {
      throw new ErroValidacao('A data é inválida.', 'data');
    }
    return texto;
  }
  return new Date(texto).toISOString().slice(0, 10);
}

/**
 * Valida um período (início/fim, inclusive). Retorna normalizado.
 * @param {{ inicio: string, fim: string }} dados
 */
export function validarPeriodo({ inicio, fim }) {
  const inicioValidado = validarData(inicio);
  const fimValidado = validarData(fim);
  if (fimValidado < inicioValidado) {
    throw new ErroValidacao('O fim do período não pode ser anterior ao início.', 'fim');
  }
  return Object.freeze({ inicio: inicioValidado, fim: fimValidado });
}

// ── Transações ───────────────────────────────────────────────────────────
/** Valida os dados de criação de uma transação (valores já em centavos). */
export function validarTransacaoCriacao(dados) {
  const tipo = validarTipoTransacao(dados?.tipo);
  return Object.freeze({
    tipo,
    valorCentavos: validarValorCentavos(dados?.valorCentavos),
    categoria: validarCategoria(dados?.categoria, tipo),
    descricao: validarDescricao(dados?.descricao),
    ocorridaEm: validarData(dados?.data ?? dados?.ocorridaEm),
  });
}

/** Valida os campos parciais de edição (combinação final resolvida no serviço). */
export function validarTransacaoEdicao(dados) {
  const resultado = {};
  if (dados && 'tipo' in dados && dados.tipo !== undefined) {
    resultado.tipo = validarTipoTransacao(dados.tipo);
  }
  if (dados && 'valorCentavos' in dados && dados.valorCentavos !== undefined) {
    resultado.valorCentavos = validarValorCentavos(dados.valorCentavos);
  }
  if (dados && 'categoria' in dados && dados.categoria !== undefined) {
    resultado.categoria = dados.categoria;
  }
  if (dados && 'descricao' in dados) {
    resultado.descricao = validarDescricao(dados.descricao);
  }
  if (dados && 'data' in dados && dados.data !== undefined) {
    resultado.ocorridaEm = validarData(dados.data);
  }
  return Object.freeze(resultado);
}

// ── Orçamentos ───────────────────────────────────────────────────────────
export const TAMANHO_MAXIMO_NOME_ORCAMENTO = 60;

/** Valida o nome opcional de um orçamento. */
export function validarNomeOrcamento(nome) {
  if (nome === null || nome === undefined || nome === '') return null;
  if (typeof nome !== 'string') {
    throw new ErroValidacao('O nome do orçamento deve ser um texto.', 'nome');
  }
  const aparado = nome.trim();
  if (aparado.length === 0) return null;
  if (aparado.length > TAMANHO_MAXIMO_NOME_ORCAMENTO) {
    throw new ErroValidacao(
      `O nome do orçamento pode ter no máximo ${TAMANHO_MAXIMO_NOME_ORCAMENTO} caracteres.`,
      'nome',
    );
  }
  return aparado;
}

/** Valida dados de criação de orçamento (categoria sempre de despesa). */
export function validarOrcamentoCriacao(dados) {
  const periodo = validarPeriodo({ inicio: dados?.inicio, fim: dados?.fim });
  return Object.freeze({
    categoria: validarCategoria(dados?.categoria, TIPOS_TRANSACAO.DESPESA),
    nome: validarNomeOrcamento(dados?.nome),
    valorCentavos: validarValorCentavos(dados?.valorCentavos),
    inicio: periodo.inicio,
    fim: periodo.fim,
  });
}
// ── Cálculo de saldo (única fonte de verdade) ────────────────────────────
/**
 * saldo = receitas confirmadas − despesas confirmadas.
 * @param {Array<{tipo: string, valorCentavos: number}>} transacoes
 */
export function calcularResumo(transacoes) {
  let receitas = 0;
  let despesas = 0;
  for (const transacao of transacoes) {
    if (transacao.tipo === TIPOS_TRANSACAO.RECEITA) receitas += transacao.valorCentavos;
    else if (transacao.tipo === TIPOS_TRANSACAO.DESPESA) despesas += transacao.valorCentavos;
  }
  return Object.freeze({ receitas, despesas, saldo: receitas - despesas });
}

/**
 * Verifica se a transação ocorreu dentro do período (limites INCLUSIVOS).
 * Datas armazenadas em 'YYYY-MM-DD' — comparação lexicográfica segura.
 */
export function transacaoNoPeriodo(transacao, inicio, fim) {
  return transacao.ocorridaEm >= inicio && transacao.ocorridaEm <= fim;
}

/**
 * Gastos (despesas) por categoria, opcionalmente dentro de um período.
 * @returns {Array<{categoria: string, valorCentavos: number}>}
 */
export function gastosPorCategoria(transacoes, { inicio = null, fim = null } = {}) {
  const gastos = new Map();
  for (const transacao of transacoes) {
    if (transacao.tipo !== TIPOS_TRANSACAO.DESPESA) continue;
    if (inicio && transacao.ocorridaEm < inicio) continue;
    if (fim && transacao.ocorridaEm > fim) continue;
    gastos.set(transacao.categoria, (gastos.get(transacao.categoria) ?? 0) + transacao.valorCentavos);
  }
  return Object.freeze(
    [...gastos.entries()].map(([categoria, valorCentavos]) =>
      Object.freeze({ categoria, valorCentavos })),
  );
}

/**
 * Situação de um orçamento a partir das despesas reais da categoria no período.
 * Receitas NUNCA consomem orçamento.
 * @returns {{ gasto: number, disponivel: number, estourado: boolean, percentual: number }}
 */
export function situacaoOrcamento(orcamento, transacoes) {
  let gasto = 0;
  for (const transacao of transacoes) {
    if (transacao.tipo !== TIPOS_TRANSACAO.DESPESA) continue;
    if (transacao.categoria !== orcamento.categoria) continue;
    if (transacao.ocorridaEm < orcamento.inicio || transacao.ocorridaEm > orcamento.fim) continue;
    gasto += transacao.valorCentavos;
  }
  const disponivel = orcamento.valorCentavos - gasto;
  return Object.freeze({
    gasto,
    disponivel,
    estourado: gasto > orcamento.valorCentavos,
    percentual: orcamento.valorCentavos === 0 ? 0 : gasto / orcamento.valorCentavos,
  });
}

// ── Conversores linha → objeto (camelCase, congelado) ─────────────────────
export function paraCarteira(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    nome: linha.nome,
    moeda: linha.moeda,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  });
}

export function paraTransacao(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    carteiraId: linha.carteira_id,
    tipo: linha.tipo,
    valorCentavos: linha.valor_centavos,
    categoria: linha.categoria,
    descricao: linha.descricao ?? null,
    ocorridaEm: linha.ocorrida_em,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  });
}

export function paraOrcamento(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    categoria: linha.categoria,
    nome: linha.nome ?? null,
    valorCentavos: linha.valor_centavos,
    inicio: linha.inicio,
    fim: linha.fim,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  });
}