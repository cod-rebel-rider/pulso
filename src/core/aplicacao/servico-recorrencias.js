/**
 * PULSO — Serviço da aplicação: Recorrências (Fase 10.3)
 *
 * Orquestra o ciclo de vida da regra de repetição (criar, editar, ativar,
 * desativar, arquivar) e as consultas. Nenhuma regra monetária: criar,
 * editar ou mudar o estado de uma recorrência NÃO gera conta, NÃO cria
 * transação e NÃO altera saldo/carteira — a geração de ocorrências é
 * exclusividade da Fase 10.4.
 *
 * A RECORRÊNCIA pertence a UM jogador e a UM serviço; o serviço precisa
 * existir e pertencer ao mesmo jogador. Nasce ATIVA; ARQUIVAR é terminal.
 */

import {
  ESTADOS_RECORRENCIA,
  ESTADO_RECORRENCIA_INICIAL,
  exigirTransicaoRecorrencia,
  recorrenciaArquivada,
  validarEstadoRecorrencia,
  validarPeriodoRecorrencia,
  validarRecorrenciaCriacao,
  validarRecorrenciaEdicao,
} from '../dominio/recorrencia.js';
import { ErroValidacao, ErroConflito } from '../erros.js';

export class ServicoRecorrencias {
  constructor({ repositorio, repositorioServico, repositorioJogador = null }) {
    this._recorrencias = repositorio;
    this._servicos = repositorioServico;
    this._jogadores = repositorioJogador;
  }

  _garantirJogador(jogadorId) {
    if (!this._jogadores) return;
    if (!this._jogadores.buscarPorId(jogadorId)) {
      throw new ErroConflito('Jogador não encontrado.');
    }
  }

  /** O serviço precisa existir E pertencer ao jogador dono da regra. */
  _garantirServico(jogadorId, servicoId) {
    const servico = this._servicos.buscarPorId(servicoId);
    if (!servico) {
      throw new ErroConflito(`Serviço ${servicoId} não encontrado.`);
    }
    if (servico.jogadorId !== jogadorId) {
      throw new ErroValidacao('O serviço selecionado não pertence a este jogador.', 'servicoId');
    }
    return servico;
  }

  obter(id) {
    const recorrencia = this._recorrencias.buscarPorId(id);
    if (!recorrencia) throw new ErroConflito(`Recorrência ${id} não encontrada.`);
    return recorrencia;
  }

  listar(jogadorId, { servicoId = null, estado = null } = {}) {
    this._garantirJogador(jogadorId);
    if (estado !== null) validarEstadoRecorrencia(estado);
    return this._recorrencias.listarPorJogador(jogadorId, { servicoId, estado });
  }

  listarAtivas(jogadorId, filtros = {}) {
    return this.listar(jogadorId, { ...filtros, estado: ESTADOS_RECORRENCIA.ATIVA });
  }

  listarInativas(jogadorId, filtros = {}) {
    return this.listar(jogadorId, { ...filtros, estado: ESTADOS_RECORRENCIA.INATIVA });
  }

  listarArquivadas(jogadorId, filtros = {}) {
    return this.listar(jogadorId, { ...filtros, estado: ESTADOS_RECORRENCIA.ARQUIVADA });
  }

  resumo(jogadorId) {
    this._garantirJogador(jogadorId);
    const todas = this._recorrencias.listarPorJogador(jogadorId);
    const ativas = todas.filter((r) => r.estado === ESTADOS_RECORRENCIA.ATIVA);
    const inativas = todas.filter((r) => r.estado === ESTADOS_RECORRENCIA.INATIVA);
    const arquivadas = todas.filter((r) => r.estado === ESTADOS_RECORRENCIA.ARQUIVADA);
    return Object.freeze({
      ativas: ativas.length,
      inativas: inativas.length,
      arquivadas: arquivadas.length,
      total: todas.length,
      // Soma ESPERADA das regras ATIVAS — expectativa da regra, não despesa
      // paga, e não movimenta dinheiro.
      valorEsperadoAtivas: ativas.reduce((soma, r) => soma + r.valorEsperado, 0),
    });
  }

  /**
   * Cria a REGRA. Nenhuma conta é gerada aqui (Fase 10.4).
   * A recorrência nasce ATIVA.
   */
  criar(jogadorId, dados) {
    if (!jogadorId || typeof jogadorId !== 'number') {
      throw new ErroValidacao('Identificador do jogador inválido.');
    }
    this._garantirJogador(jogadorId);
    const validados = validarRecorrenciaCriacao(dados ?? {});
    this._garantirServico(jogadorId, validados.servicoId);
    return this._recorrencias.criar(jogadorId, validados, ESTADO_RECORRENCIA_INICIAL);
  }

  atualizar(id, dados) {
    const atual = this.obter(id);
    if (recorrenciaArquivada(atual.estado)) {
      throw new ErroValidacao('Uma recorrência arquivada não pode ser editada (está encerrada).');
    }
    if (dados && 'estado' in dados) {
      throw new ErroValidacao('O estado muda apenas por ações de domínio (ativar/desativar/arquivar).');
    }
    if (dados && 'servicoId' in dados && Number(dados.servicoId) !== atual.servicoId) {
      throw new ErroValidacao('O serviço da recorrência não pode ser alterado.');
    }
    if (dados && 'jogadorId' in dados && Number(dados.jogadorId) !== atual.jogadorId) {
      throw new ErroValidacao('O jogador dono da recorrência não pode ser alterado.');
    }
    const validados = validarRecorrenciaEdicao(dados ?? {});
    if (Object.keys(validados).length === 0) {
      throw new ErroValidacao('Nenhum campo válido para atualizar.');
    }
    // Período revalidado com os campos FINAIS (presentes + existentes).
    const dataInicio = validados.dataInicio ?? atual.dataInicio;
    const dataFim = 'dataFim' in validados ? validados.dataFim : atual.dataFim;
    validarPeriodoRecorrencia(dataInicio, dataFim);
    return this._recorrencias.atualizar(id, {
      frequencia: validados.frequencia ?? atual.frequencia,
      dataInicio,
      dataFim,
      diaVencimento: validados.diaVencimento ?? atual.diaVencimento,
      valorEsperado: validados.valorEsperado ?? atual.valorEsperado,
      descricao: 'descricao' in validados ? validados.descricao : atual.descricao,
    });
  }

  /** Reativar: apenas inativa → ativa (arquivada é terminal). */
  ativar(id) {
    const atual = this.obter(id);
    exigirTransicaoRecorrencia(atual.estado, ESTADOS_RECORRENCIA.ATIVA);
    return this._recorrencias.atualizarEstado(id, ESTADOS_RECORRENCIA.ATIVA);
  }

  desativar(id) {
    const atual = this.obter(id);
    exigirTransicaoRecorrencia(atual.estado, ESTADOS_RECORRENCIA.INATIVA);
    return this._recorrencias.atualizarEstado(id, ESTADOS_RECORRENCIA.INATIVA);
  }

  /** Terminal nesta subfase: a arquivada não volta a ser ativa. */
  arquivar(id) {
    const atual = this.obter(id);
    exigirTransicaoRecorrencia(atual.estado, ESTADOS_RECORRENCIA.ARQUIVADA);
    return this._recorrencias.arquivar(id);
  }
}