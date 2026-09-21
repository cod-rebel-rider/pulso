/**
 * PULSO — Serviço da aplicação: Contas / Despesas (Fase 10.2)
 *
 * Orquestra o ciclo de vida da conta (criar, editar, cancelar) e as
 * consultas. Nenhuma regra monetária: criar/editar/cancelar uma conta NÃO
 * cria transação e NÃO altera saldo/carteira — o pagamento é futuro (10.5).
 *
 * A CONTA é uma OCORRÊNCIA de um SERVIÇO existente do MESMO jogador. O
 * estado persistido é `pendente`/`cancelada`; a situação apresentada
 * (`pendente`/`vencida`/`cancelada`) é derivada em `situacaoConta`.
 */

import {
  ESTADO_CONTA_INICIAL,
  SITUACOES_CONTA,
  SITUACOES_CONTA_ORDEM,
  contaCancelada,
  dataHojeIso,
  exigirCancelamentoConta,
  situacaoConta,
  validarContaCriacao,
  validarContaEdicao,
} from '../dominio/conta.js';
import { ErroValidacao, ErroConflito } from '../erros.js';

export class ServicoContas {
  constructor({ repositorio, repositorioServico, repositorioJogador = null }) {
    this._contas = repositorio;
    this._servicos = repositorioServico;
    this._jogadores = repositorioJogador;
  }

  _garantirJogador(jogadorId) {
    if (!this._jogadores) return;
    if (!this._jogadores.buscarPorId(jogadorId)) {
      throw new ErroConflito('Jogador não encontrado.');
    }
  }

  /** O serviço precisa existir E pertencer ao jogador dono da conta. */
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

  /** Anexa a situação derivada (nunca gravada no banco). */
  _comSituacao(conta, hoje = dataHojeIso()) {
    if (!conta) return null;
    return Object.freeze({ ...conta, situacao: situacaoConta(conta, hoje) });
  }

  obter(id) {
    const conta = this._contas.buscarPorId(id);
    if (!conta) throw new ErroConflito(`Conta ${id} não encontrada.`);
    return this._comSituacao(conta);
  }

  /**
   * Lista as contas do jogador, opcionalmente por serviço e por SITUAÇÃO
   * derivada ('todas' | 'pendente' | 'vencida' | 'cancelada').
   */
  listar(jogadorId, { servicoId = null, situacao = null, hoje = null } = {}) {
    this._garantirJogador(jogadorId);
    const referencia = hoje ?? dataHojeIso();
    const contas = this._contas
      .listarPorJogador(jogadorId, { servicoId })
      .map((conta) => this._comSituacao(conta, referencia));

    if (!situacao || situacao === 'todas') return contas;
    if (!SITUACOES_CONTA_ORDEM.includes(situacao)) {
      throw new ErroValidacao(
        `Situação inválida: ${String(situacao)}. Situações: ${SITUACOES_CONTA_ORDEM.join(', ')}.`,
        'situacao',
      );
    }
    return contas.filter((conta) => conta.situacao === situacao);
  }

  listarPendentes(jogadorId, filtros = {}) {
    return this.listar(jogadorId, { ...filtros, situacao: SITUACOES_CONTA.PENDENTE });
  }

  listarVencidas(jogadorId, filtros = {}) {
    return this.listar(jogadorId, { ...filtros, situacao: SITUACOES_CONTA.VENCIDA });
  }

  listarCanceladas(jogadorId, filtros = {}) {
    return this.listar(jogadorId, { ...filtros, situacao: SITUACOES_CONTA.CANCELADA });
  }

  resumo(jogadorId, { hoje = null } = {}) {
    this._garantirJogador(jogadorId);
    const contas = this.listar(jogadorId, { hoje });
    const pendentes = contas.filter((c) => c.situacao === SITUACOES_CONTA.PENDENTE);
    const vencidas = contas.filter((c) => c.situacao === SITUACOES_CONTA.VENCIDA);
    const canceladas = contas.filter((c) => c.situacao === SITUACOES_CONTA.CANCELADA);
    return Object.freeze({
      pendentes: pendentes.length,
      vencidas: vencidas.length,
      canceladas: canceladas.length,
      total: contas.length,
      // Soma ESPERADA das contas em aberto (pendentes + vencidas) — é
      // expectativa, não despesa paga, e não movimenta dinheiro.
      valorEsperadoEmAberto:
        [...pendentes, ...vencidas].reduce((soma, c) => soma + c.valorEsperado, 0),
    });
  }

  criar(jogadorId, dados) {
    if (!jogadorId || typeof jogadorId !== 'number') {
      throw new ErroValidacao('Identificador do jogador inválido.');
    }
    this._garantirJogador(jogadorId);
    const validados = validarContaCriacao(dados ?? {});
    this._garantirServico(jogadorId, validados.servicoId);
    const existente = this._contas.buscarPorServicoEReferencia(
      validados.servicoId,
      validados.referencia,
    );
    if (existente) {
      throw new ErroConflito(
        `Já existe uma conta deste serviço para a referência ${validados.referencia}.`,
      );
    }
    return this._comSituacao(this._contas.criar(jogadorId, validados, ESTADO_CONTA_INICIAL));
  }

  atualizar(id, dados) {
    const atual = this.obter(id);
    if (contaCancelada(atual.estado)) {
      throw new ErroValidacao('Uma conta cancelada não pode ser editada.');
    }
    if (dados && 'estado' in dados) {
      throw new ErroValidacao('O estado muda apenas por ações de domínio (cancelar).');
    }
    if (dados && 'servicoId' in dados && Number(dados.servicoId) !== atual.servicoId) {
      throw new ErroValidacao('O serviço da conta não pode ser alterado.');
    }
    if (dados && 'jogadorId' in dados && Number(dados.jogadorId) !== atual.jogadorId) {
      throw new ErroValidacao('O jogador dono da conta não pode ser alterado.');
    }
    const validados = validarContaEdicao(dados ?? {});
    if (Object.keys(validados).length === 0) {
      throw new ErroValidacao('Nenhum campo válido para atualizar.');
    }
    const referencia = validados.referencia ?? atual.referencia;
    if (referencia !== atual.referencia) {
      const existente = this._contas.buscarPorServicoEReferencia(atual.servicoId, referencia);
      if (existente && existente.id !== atual.id) {
        throw new ErroConflito(
          `Já existe uma conta deste serviço para a referência ${referencia}.`,
        );
      }
    }
    return this._comSituacao(
      this._contas.atualizar(id, {
        referencia,
        descricao: 'descricao' in validados ? validados.descricao : atual.descricao,
        valorEsperado: validados.valorEsperado ?? atual.valorEsperado,
        vencimento: validados.vencimento ?? atual.vencimento,
      }),
    );
  }

  cancelar(id) {
    const atual = this.obter(id);
    exigirCancelamentoConta(atual.estado);
    return this._comSituacao(this._contas.cancelar(id));
  }
}
