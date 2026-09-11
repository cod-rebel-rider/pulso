/**
 * PULSO — Serviço de Projetos (Fase 07 — Projetos)
 *
 * Orquestra criação, edição, transições e vínculo com missões.
 * Projeto organiza e acompanha — NÃO concede XP, dinheiro, atributos
 * nem altera status.
 */

import {
  ESTADOS_PROJETO,
  validarProjetoCriacao,
  validarProjetoEdicao,
  exigirTransicaoProjeto,
  calcularProgressoProjeto,
  projetoAtrasado,
} from '../dominio/projeto.js';
import { ErroValidacao, ErroConflito } from '../erros.js';

export class ServicoProjeto {
  /** @param {{ repositorio, repositorioMissao, repositorioJogador? }} deps */
  constructor({ repositorio, repositorioMissao, repositorioJogador = null }) {
    this._repositorio = repositorio;
    this._missoes = repositorioMissao;
    this._jogadores = repositorioJogador;
  }

  _garantirJogador(jogadorId) {
    if (!this._jogadores) return;
    if (!this._jogadores.buscarPorId(jogadorId)) {
      throw new ErroConflito('Jogador não encontrado.');
    }
  }

  /** Projeto pelo id (+missões e progresso calculados). */
  obter(id) {
    const projeto = this._repositorio.buscarPorId(id);
    if (!projeto) throw new ErroConflito(`Projeto ${id} não encontrado.`);
    return this._completar(projeto);
  }

  /** Todos os projetos do jogador (+progresso e atraso). */
  listar(jogadorId) {
    this._garantirJogador(jogadorId);
    return this._repositorio.listarPorJogador(jogadorId).map((p) => this._completar(p));
  }

  /** Cria um projeto (estado inicial sempre PLANEJADO). */
  criar(jogadorId, dados) {
    if (!jogadorId || typeof jogadorId !== 'number') {
      throw new ErroValidacao('Identificador do jogador inválido.');
    }
    this._garantirJogador(jogadorId);
    const validados = validarProjetoCriacao(dados);
    const projeto = this._repositorio.criar(jogadorId, validados, ESTADOS_PROJETO.PLANEJADO);
    return this._completar(projeto);
  }

  /** Edita título/descrição/prioridade/prazo (nunca estado livre). */
  atualizar(id, dados) {
    const atual = this.obter(id);
    if (dados && 'estado' in dados) {
      throw new ErroValidacao('O estado muda apenas por ações de domínio (iniciar/concluir/cancelar/arquivar).');
    }
    const validados = validarProjetoEdicao(dados ?? {});
    if (Object.keys(validados).length === 0) {
      throw new ErroValidacao('Nenhum campo válido para atualizar.');
    }
    const projeto = this._repositorio.atualizar(id, {
      titulo: validados.titulo ?? atual.titulo,
      descricao: 'descricao' in validados ? validados.descricao : atual.descricao,
      estado: atual.estado,
      prioridade: validados.prioridade ?? atual.prioridade,
      prazo: 'prazo' in validados ? validados.prazo : atual.prazo,
      iniciadaEm: atual.iniciadaEm,
      concluidaEm: atual.concluidaEm,
      canceladaEm: atual.canceladaEm,
    });
    return this._completar(projeto);
  }

  /** Ações de domínio (máquina de estados explícita). */
  iniciar(id) {
    return this._transitar(id, ESTADOS_PROJETO.EM_ANDAMENTO, { iniciadaEm: new Date().toISOString() });
  }

  concluir(id) {
    return this._transitar(id, ESTADOS_PROJETO.CONCLUIDO, { concluidaEm: new Date().toISOString() });
  }

  cancelar(id) {
    return this._transitar(id, ESTADOS_PROJETO.CANCELADO, { canceladaEm: new Date().toISOString() });
  }

  arquivar(id) {
    return this._transitar(id, ESTADOS_PROJETO.ARQUIVADO, {});
  }

  /** Exclusão física (técnica; interface prefere arquivar/cancelar). */
  excluir(id) {
    const atual = this.obter(id);
    if (atual.estado !== ESTADOS_PROJETO.ARQUIVADO && atual.estado !== ESTADOS_PROJETO.CANCELADO) {
      throw new ErroValidacao('A exclusão física exige projeto arquivado ou cancelado (prefira arquivar).');
    }
    this._repositorio.excluir(id);
  }

  /** Associa missão existente (referência; mesmo jogador; sem dois projetos). */
  associarMissao(projetoId, missaoId) {
    const projeto = this.obter(projetoId);
    const missao = this._missoes.buscarPorId(missaoId);
    if (!missao) throw new ErroConflito(`Missão ${missaoId} não encontrada.`);
    if (missao.jogadorId !== projeto.jogadorId) {
      throw new ErroConflito('Projeto e missão pertencem a jogadores diferentes.');
    }
    if (missao.projetoId && missao.projetoId !== projeto.id) {
      throw new ErroConflito('Esta missão já pertence a outro projeto.');
    }
    this._repositorio.vincularMissao(missaoId, projetoId);
    return this.obter(projetoId);
  }

  /** Remove a missão do projeto (missão continua existindo). */
  removerMissao(projetoId, missaoId) {
    const projeto = this.obter(projetoId);
    const missao = this._missoes.buscarPorId(missaoId);
    if (!missao) throw new ErroConflito(`Missão ${missaoId} não encontrada.`);
    if (missao.projetoId !== projeto.id) {
      throw new ErroConflito('Esta missão não pertence a este projeto.');
    }
    this._repositorio.desvincularMissao(missaoId);
    return this.obter(projetoId);
  }

  /** Missões do projeto. */
  listarMissoes(projetoId) {
    this.obter(projetoId);
    return this._repositorio.listarMissoes(projetoId);
  }

  _completar(projeto) {
    const missoes = this._repositorio.listarMissoes(projeto.id);
    return Object.freeze({
      ...projeto,
      missoes: Object.freeze(missoes),
      totalMissoes: missoes.length,
      missoesConcluidas: missoes.filter((m) => m.estado === 'concluida').length,
      progresso: calcularProgressoProjeto(missoes),
      atrasado: projetoAtrasado(projeto.estado, projeto.prazo),
      prontaParaEncerrar: missoes.length > 0 && missoes.every((m) => m.estado === 'concluida'),
    });
  }

  _transitar(id, proximo, carimbos) {
    const atual = this.obter(id);
    exigirTransicaoProjeto(atual.estado, proximo);
    const projeto = this._repositorio.atualizar(id, {
      titulo: atual.titulo,
      descricao: atual.descricao,
      estado: proximo,
      prioridade: atual.prioridade,
      prazo: atual.prazo,
      iniciadaEm: carimbos.iniciadaEm ?? atual.iniciadaEm,
      concluidaEm: carimbos.concluidaEm ?? atual.concluidaEm,
      canceladaEm: carimbos.canceladaEm ?? atual.canceladaEm,
    });
    return this._completar(projeto);
  }
}

