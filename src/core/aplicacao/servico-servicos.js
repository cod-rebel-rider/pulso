/**
 * PULSO — Serviço da aplicação: Serviços do jogador (Fase 10.1)
 *
 * Nome da classe no plural para evitar confusão com a camada: este é o
 * "serviço (application) dos serviços (domínio)". Orquestra criação,
 * edição e ciclo de vida — nenhuma regra monetária: criar/editar/mudar
 * estado de um serviço NÃO cria transação e NÃO altera saldo/carteira.
 * O valor esperado é estimativa (ver docs/servicos.md).
 */

import {
  ESTADOS_SERVICO,
  ESTADO_SERVICO_INICIAL,
  exigirTransicaoServico,
  servicoArquivado,
  validarServicoCriacao,
  validarServicoEdicao,
} from '../dominio/servico.js';
import { ErroValidacao, ErroConflito, ErroTransicao } from '../erros.js';

export class ServicoServicos {
  constructor({ repositorio, repositorioJogador = null }) {
    this._servicos = repositorio;
    this._jogadores = repositorioJogador;
  }

  _garantirJogador(jogadorId) {
    if (!this._jogadores) return;
    if (!this._jogadores.buscarPorId(jogadorId)) {
      throw new ErroConflito('Jogador não encontrado.');
    }
  }

  obter(id) {
    const servico = this._servicos.buscarPorId(id);
    if (!servico) throw new ErroConflito(`Serviço ${id} não encontrado.`);
    return servico;
  }

  listar(jogadorId, filtros = {}) {
    this._garantirJogador(jogadorId);
    return this._servicos.listarPorJogador(jogadorId, filtros);
  }

  resumo(jogadorId) {
    this._garantirJogador(jogadorId);
    const todos = this._servicos.listarPorJogador(jogadorId);
    const ativos = todos.filter((s) => s.estado === ESTADOS_SERVICO.ATIVO);
    const inativos = todos.filter((s) => s.estado === ESTADOS_SERVICO.INATIVO);
    const arquivados = todos.filter((s) => s.estado === ESTADOS_SERVICO.ARQUIVADO);
    return Object.freeze({
      ativos: ativos.length,
      inativos: inativos.length,
      arquivados: arquivados.length,
      total: todos.length,
      // Estimativa de custo mensal dos serviços ATIVOS (soma do esperado).
      // Continua sendo estimativa — não é despesa nem movimento financeiro.
      custoEstimadoAtivos: ativos.reduce((soma, s) => soma + s.valorEsperado, 0),
    });
  }

  criar(jogadorId, dados) {
    if (!jogadorId || typeof jogadorId !== 'number') {
      throw new ErroValidacao('Identificador do jogador inválido.');
    }
    this._garantirJogador(jogadorId);
    const validados = validarServicoCriacao(dados ?? {});
    return this._servicos.criar(jogadorId, validados, ESTADO_SERVICO_INICIAL);
  }

  atualizar(id, dados) {
    const atual = this.obter(id);
    if (servicoArquivado(atual.estado)) {
      throw new ErroValidacao('Um serviço arquivado não pode ser editado (está encerrado).');
    }
    if (dados && 'estado' in dados) {
      throw new ErroValidacao('O estado muda apenas por ações de domínio (ativar/desativar/arquivar).');
    }
    if (dados && 'jogadorId' in dados && Number(dados.jogadorId) !== atual.jogadorId) {
      throw new ErroValidacao('O jogador dono do serviço não pode ser alterado.');
    }
    const validados = validarServicoEdicao(dados ?? {});
    if (Object.keys(validados).length === 0) {
      throw new ErroValidacao('Nenhum campo válido para atualizar.');
    }
    return this._servicos.atualizar(id, {
      nome: validados.nome ?? atual.nome,
      descricao: 'descricao' in validados ? validados.descricao : atual.descricao,
      fornecedor: 'fornecedor' in validados ? validados.fornecedor : atual.fornecedor,
      categoria: validados.categoria ?? atual.categoria,
      valorEsperado: validados.valorEsperado ?? atual.valorEsperado,
    });
  }

  ativar(id) {
    const atual = this.obter(id);
    exigirTransicaoServico(atual.estado, ESTADOS_SERVICO.ATIVO);
    return this._servicos.atualizarEstado(id, ESTADOS_SERVICO.ATIVO);
  }

  desativar(id) {
    const atual = this.obter(id);
    exigirTransicaoServico(atual.estado, ESTADOS_SERVICO.INATIVO);
    return this._servicos.atualizarEstado(id, ESTADOS_SERVICO.INATIVO);
  }

  arquivar(id) {
    const atual = this.obter(id);
    exigirTransicaoServico(atual.estado, ESTADOS_SERVICO.ARQUIVADO);
    return this._servicos.arquivar(id);
  }
}
