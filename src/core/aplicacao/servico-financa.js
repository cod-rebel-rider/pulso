/**
 * PULSO — Serviço de Finanças (Fase 08 — Finanças)
 *
 * Orquestra carteira, transações e orçamentos, aplicando as regras do
 * domínio antes de qualquer persistência. É a única porta usada pela camada
 * de IPC — o renderer nunca alcança o repositório diretamente.
 *
 * Regras centrais:
 * - saldo = consequência das transações (nunca valor editado);
 * - categorias validadas contra o tipo da transação;
 * - orçamento apenas acompanha despesas reais do período.
 */

import {
  MOEDA,
  NOME_CARTEIRA_PRINCIPAL,
  TIPOS_TRANSACAO_ORDEM,
  TIPOS_TRANSACAO_ROTULOS,
  CATEGORIAS_RECEITA,
  CATEGORIAS_DESPESA,
  validarTipoTransacao,
  validarCategoria,
  validarTransacaoCriacao,
  validarOrcamentoCriacao,
  calcularResumo,
  gastosPorCategoria,
  situacaoOrcamento,
} from '../dominio/financa.js';
import { ErroConflito, ErroValidacao } from '../erros.js';

export class ServicoFinanca {
  /**
   * @param {{
   *   repositorioCarteira: import('../database/repositorios/carteira.js').RepositorioCarteira,
   *   repositorioTransacao: import('../database/repositorios/transacao.js').RepositorioTransacao,
   *   repositorioOrcamento: import('../database/repositorios/orcamento.js').RepositorioOrcamento,
   *   repositorioJogador?: import('../database/repositorios/jogador.js').RepositorioJogador
   * }}
   */
  constructor({ repositorioCarteira, repositorioTransacao, repositorioOrcamento, repositorioJogador }) {
    this._carteiras = repositorioCarteira;
    this._transacoes = repositorioTransacao;
    this._orcamentos = repositorioOrcamento;
    this._jogadores = repositorioJogador ?? null;
  }

  /** Configuração financeira para a interface (fonte única das categorias). */
  config() {
    return Object.freeze({
      moeda: MOEDA,
      nomeCarteiraPrincipal: NOME_CARTEIRA_PRINCIPAL,
      tipos: TIPOS_TRANSACAO_ORDEM,
      rotulosTipos: TIPOS_TRANSACAO_ROTULOS,
      categoriasReceita: CATEGORIAS_RECEITA,
      categoriasDespesa: CATEGORIAS_DESPESA,
    });
  }

  _garantirJogador(jogadorId) {
    if (!this._jogadores) return;
    if (!this._jogadores.buscarPorId(jogadorId)) {
      throw new ErroConflito('Jogador não encontrado.');
    }
  }

  /**
   * Garante a existência da carteira principal do jogador (idempotente).
   * Jogadores criados antes da Fase 08 também recebem a carteira sob demanda.
   */
  garantirCarteiraPrincipal(jogadorId) {
    const existente = this._carteiras.buscarPorJogador(jogadorId);
    if (existente) return existente;
    return this._carteiras.criar(jogadorId, { nome: NOME_CARTEIRA_PRINCIPAL, moeda: MOEDA });
  }

  /** Criação da carteira inicial no nascimento do jogador (mesma transação). */
  criarCarteiraInicial(jogadorId) {
    return this.garantirCarteiraPrincipal(jogadorId);
  }

  /** Carteira do jogador + saldo atual (consequência das transações). */
  obterCarteira(jogadorId) {
    this._garantirJogador(jogadorId);
    const carteira = this.garantirCarteiraPrincipal(jogadorId);
    const transacoes = this._transacoes.listarPorCarteira(carteira.id);
    return Object.freeze({ ...carteira, saldo: calcularResumo(transacoes).saldo });
  }

  /** Saldo geral + receitas/despesas de um período (opcional). */
  obterSaldo(jogadorId, { inicio = null, fim = null } = {}) {
    const carteira = this.obterCarteira(jogadorId);
    const transacoesPeriodo = this._transacoes.listarPorCarteira(carteira.id, { inicio, fim });
    const resumo = calcularResumo(transacoesPeriodo);
    return Object.freeze({ ...resumo, carteira });
  }

  /**
   * Resumo completo para a tela financeira (Fase 08):
   * carteira, saldo, receitas/despesas do período, orçamentos com situação e
   * gastos por categoria — tudo derivado das transações.
   */
  obterResumo(jogadorId, { inicio = null, fim = null } = {}) {
    const carteira = this.obterCarteira(jogadorId);
    const transacoesTodas = this._transacoes.listarPorCarteira(carteira.id);
    const transacoesPeriodo = inicio || fim
      ? this._transacoes.listarPorCarteira(carteira.id, { inicio, fim })
      : transacoesTodas;
    const resumoPeriodo = calcularResumo(transacoesPeriodo);
    return Object.freeze({
      carteira,
      saldo: calcularResumo(transacoesTodas).saldo,
      receitas: resumoPeriodo.receitas,
      despesas: resumoPeriodo.despesas,
      orcamentos: this.listarOrcamentos(jogadorId),
      gastosPorCategoria: gastosPorCategoria(transacoesPeriodo),
      config: this.config(),
    });
  }
// ── Transações ──────────────────────────────────────────────────────
  /** Cria uma transação na carteira principal do jogador. */
  criarTransacao(jogadorId, dados) {
    this._garantirJogador(jogadorId);
    const carteira = this.garantirCarteiraPrincipal(jogadorId);
    const validados = validarTransacaoCriacao(dados ?? {});
    return this._transacoes.criar(carteira.id, validados);
  }

  /** Busca uma transação pelo id. */
  obterTransacao(id) {
    const transacao = this._transacoes.buscarPorId(id);
    if (!transacao) {
      throw new ErroConflito(`Transação ${id} não encontrada.`);
    }
    return transacao;
  }

  /**
   * Atualiza uma transação. A alteração reflete no saldo automaticamente,
   * pois o saldo é sempre recalculado a partir do conjunto persistido.
   */
  atualizarTransacao(id, dados) {
    const atual = this.obterTransacao(id);
    const tipo = dados?.tipo !== undefined ? dados.tipo : atual.tipo;
    const categoria = dados?.categoria !== undefined ? dados.categoria : atual.categoria;
    const tipoValidado = validarTipoTransacao(tipo);
    const categoriaValidada = validarCategoria(categoria, tipoValidado);
    const resolvidos = {
      tipo: tipoValidado,
      valorCentavos: dados?.valorCentavos ?? atual.valorCentavos,
      categoria: categoriaValidada,
      descricao: 'descricao' in (dados ?? {}) ? dados.descricao : atual.descricao,
      data: dados?.data !== undefined ? dados.data : atual.ocorridaEm,
    };
    const validados = validarTransacaoCriacao(resolvidos);
    return this._transacoes.atualizar(id, validados);
  }

  /** Exclusão controlada (a interface pede confirmação antes). */
  excluirTransacao(id) {
    this.obterTransacao(id);
    this._transacoes.excluir(id);
  }

  /** Histórico da carteira, mais recente primeiro, com filtros opcionais. */
  listarTransacoes(jogadorId, { tipo = null, categoria = null, inicio = null, fim = null } = {}) {
    const carteira = this.obterCarteira(jogadorId);
    return this._transacoes.listarPorCarteira(carteira.id, { tipo, categoria, inicio, fim });
  }

  // ── Orçamentos ─────────────────────────────────────────────────────────
  /** Cria um orçamento de despesa por categoria, num período definido. */
  criarOrcamento(jogadorId, dados) {
    this._garantirJogador(jogadorId);
    const validados = validarOrcamentoCriacao(dados ?? {});
    return this._orcamentos.criar(jogadorId, validados);
  }

  /** Busca um orçamento pelo id. */
  obterOrcamento(id) {
    const orcamento = this._orcamentos.buscarPorId(id);
    if (!orcamento) {
      throw new ErroConflito(`Orçamento ${id} não encontrado.`);
    }
    return orcamento;
  }

  /** Atualiza um orçamento existente. */
  atualizarOrcamento(id, dados) {
    const atual = this.obterOrcamento(id);
    const resolvidos = {
      categoria: dados?.categoria ?? atual.categoria,
      nome: 'nome' in (dados ?? {}) ? dados.nome : atual.nome,
      valorCentavos: dados?.valorCentavos ?? atual.valorCentavos,
      inicio: dados?.inicio ?? atual.inicio,
      fim: dados?.fim ?? atual.fim,
    };
    const validados = validarOrcamentoCriacao(resolvidos);
    return this._orcamentos.atualizar(id, validados);
  }

  /** Exclusão controlada de orçamento. */
  excluirOrcamento(id) {
    this.obterOrcamento(id);
    this._orcamentos.excluir(id);
  }

  /** Os orçamentos do jogador, com a situação calculada das despesas reais. */
  listarOrcamentos(jogadorId) {
    this._garantirJogador(jogadorId);
    const carteira = this.garantirCarteiraPrincipal(jogadorId);
    const transacoes = this._transacoes.listarPorCarteira(carteira.id);
    return this._orcamentos.listarPorJogador(jogadorId).map((orcamento) =>
      Object.freeze({ ...orcamento, situacao: situacaoOrcamento(orcamento, transacoes) }));
  }

  /** Situação de um orçamento específico (gasto, disponível, estourado). */
  situacaoOrcamento(id) {
    const orcamento = this.obterOrcamento(id);
    const carteira = this.garantirCarteiraPrincipal(orcamento.jogadorId);
    const transacoes = this._transacoes.listarPorCarteira(carteira.id);
    return Object.freeze({
      orcamento,
      situacao: situacaoOrcamento(orcamento, transacoes),
    });
  }
}