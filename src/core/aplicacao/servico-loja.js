/**
 * PULSO — Servico da Loja / Lista de Desejos (Fase 09)
 *
 * O desejo NAO movimenta dinheiro; a COMPRA cria uma despesa
 * via ServicoFinanca (Fase 08), de forma atomica.
 */

import {
  ESTADOS_DESEJO,
  ESTADO_DESEJO_INICIAL,
  exigirTransicaoDesejo,
  validarDesejoCriacao,
  validarDesejoEdicao,
  validarCompraDesejo,
  calcularDiferencaCompra,
  categoriaFinanceiraDoDesejo,
  descricaoTransacaoCompra,
  desejoAtivo,
} from '../dominio/loja.js';
import { validarCategoria } from '../dominio/financa.js';
import { comTransacao } from '../database/transacao.js';
import { ErroValidacao, ErroConflito, ErroTransicao } from '../erros.js';

export class ServicoLoja {
  constructor({ repositorio, repositorioJogador = null, servicoFinanca = null, banco = null }) {
    this._desejos = repositorio;
    this._jogadores = repositorioJogador;
    this._financa = servicoFinanca;
    this._banco = banco;
  }

  _garantirJogador(jogadorId) {
    if (!this._jogadores) return;
    if (!this._jogadores.buscarPorId(jogadorId)) {
      throw new ErroConflito('Jogador nao encontrado.');
    }
  }

  _garantirFinanca() {
    if (!this._financa) {
      throw new ErroConflito('Servico financeiro indisponivel para registrar a compra.');
    }
  }

  obter(id) {
    const desejo = this._desejos.buscarPorId(id);
    if (!desejo) throw new ErroConflito(`Desejo ${id} nao encontrado.`);
    return desejo;
  }

  listar(jogadorId, filtros = {}) {
    this._garantirJogador(jogadorId);
    return this._desejos.listarPorJogador(jogadorId, filtros);
  }

  listarComprados(jogadorId) {
    this._garantirJogador(jogadorId);
    return this._desejos.listarComprados(jogadorId);
  }

  resumo(jogadorId) {
    this._garantirJogador(jogadorId);
    const todos = this._desejos.listarPorJogador(jogadorId);
    const ativos = todos.filter((d) => desejoAtivo(d.estado));
    const planejados = todos.filter((d) => d.estado === ESTADOS_DESEJO.PLANEJADO);
    const comprados = todos.filter((d) => d.estado === ESTADOS_DESEJO.COMPRADO);
    const valorEstimado = ativos.reduce((soma, d) => soma + d.precoEsperado, 0);
    const valorPago = comprados.reduce((soma, d) => soma + (d.precoFinal ?? 0), 0);
    const diferencas = comprados.reduce((soma, d) => soma + (d.diferencaCentavos ?? 0), 0);
    return Object.freeze({
      ativos: ativos.length,
      planejados: planejados.length,
      comprados: comprados.length,
      total: todos.length,
      valorEstimado,
      valorPago,
      economiaHistorica: -diferencas,
    });
  }

  criar(jogadorId, dados) {
    if (!jogadorId || typeof jogadorId !== 'number') {
      throw new ErroValidacao('Identificador do jogador invalido.');
    }
    this._garantirJogador(jogadorId);
    const validados = validarDesejoCriacao(dados ?? {});
    return this._desejos.criar(jogadorId, validados, ESTADO_DESEJO_INICIAL);
  }


  atualizar(id, dados) {
    const atual = this.obter(id);
    if (atual.estado === ESTADOS_DESEJO.COMPRADO) {
      throw new ErroValidacao('Um item comprado nao pode ser editado (preserva o historico).');
    }
    if (atual.estado === ESTADOS_DESEJO.CANCELADO) {
      throw new ErroValidacao('Um item cancelado nao pode ser editado (crie um novo desejo).');
    }
    if (dados && 'estado' in dados) {
      throw new ErroValidacao('O estado muda apenas por acoes de dominio.');
    }
    const validados = validarDesejoEdicao(dados ?? {});
    if (Object.keys(validados).length === 0) {
      throw new ErroValidacao('Nenhum campo valido para atualizar.');
    }
    return this._desejos.atualizar(id, {
      titulo: validados.titulo ?? atual.titulo,
      descricao: 'descricao' in validados ? validados.descricao : atual.descricao,
      categoria: validados.categoria ?? atual.categoria,
      prioridade: validados.prioridade ?? atual.prioridade,
      precoEsperado: validados.precoEsperado ?? atual.precoEsperado,
    });
  }

  analisar(id) {
    return this._transitar(id, ESTADOS_DESEJO.EM_ANALISE);
  }

  planejar(id) {
    const atual = this.obter(id);
    if (atual.estado === ESTADOS_DESEJO.DESEJADO && this._banco) {
      return comTransacao(this._banco, () => {
        const passo = this._transitarInterno(atual, ESTADOS_DESEJO.EM_ANALISE);
        return this._transitarInterno(passo, ESTADOS_DESEJO.PLANEJADO);
      });
    }
    if (atual.estado === ESTADOS_DESEJO.DESEJADO && !this._banco) {
      const passo = this._desejos.atualizarEstado(id, ESTADOS_DESEJO.EM_ANALISE);
      return this._desejos.atualizarEstado(passo.id, ESTADOS_DESEJO.PLANEJADO);
    }
    return this._transitar(id, ESTADOS_DESEJO.PLANEJADO);
  }

  cancelar(id) {
    const atual = this.obter(id);
    if (atual.estado === ESTADOS_DESEJO.COMPRADO) {
      throw new ErroTransicao('Um item comprado nao pode ser cancelado.');
    }
    return this._transitar(id, ESTADOS_DESEJO.CANCELADO);
  }

  comprar(id, dadosCompra) {
    this._garantirFinanca();
    const atual = this.obter(id);
    if (atual.estado === ESTADOS_DESEJO.COMPRADO) {
      throw new ErroTransicao('Este item ja foi comprado.');
    }
    if (atual.estado === ESTADOS_DESEJO.CANCELADO) {
      throw new ErroTransicao('Um item cancelado nao pode ser comprado (crie um novo desejo).');
    }
    exigirTransicaoDesejo(atual.estado, ESTADOS_DESEJO.COMPRADO);
    const compra = validarCompraDesejo(dadosCompra ?? {});
    const { diferencaCentavos } = calcularDiferencaCompra(atual.precoEsperado, compra.precoFinal);
    const categoriaFinanceira = categoriaFinanceiraDoDesejo(atual.categoria);
    validarCategoria(categoriaFinanceira, 'despesa');
    const executar = () => {
      const transacao = this._financa.criarTransacao(atual.jogadorId, {
        tipo: 'despesa',
        valorCentavos: compra.precoFinal,
        categoria: categoriaFinanceira,
        descricao: descricaoTransacaoCompra(atual.titulo),
        data: compra.data,
      });
      return this._desejos.registrarCompra(id, {
        precoFinal: compra.precoFinal,
        diferencaCentavos,
        data: compra.data,
        observacao: compra.observacao,
        transacaoId: transacao.id,
      });
    };
    return this._banco ? comTransacao(this._banco, executar) : executar();
  }

  _transitar(id, proximo) {
    const atual = this.obter(id);
    return this._transitarInterno(atual, proximo);
  }

  _transitarInterno(atual, proximo) {
    exigirTransicaoDesejo(atual.estado, proximo);
    return this._desejos.atualizarEstado(atual.id, proximo);
  }
}
