/**
 * PULSO — Aplicação: serviço de Progressão (Fase 06 — Progressão)
 *
 * Orquestra XP, nível, pontos e atributos. Aplica as regras do domínio
 * antes de persistir. O renderer alcança esta camada apenas via IPC.
 */

import {
  NIVEL_INICIAL,
  XP_INICIAL,
  PONTOS_INICIAIS,
  atributosIniciais,
  calcularProgresso,
  validarQuantidadeXp,
  validarNomeAtributo,
  adicionarXp,
  aumentarAtributo,
} from '../dominio/progressao.js';
import { comTransacao } from '../database/transacao.js';
import { ErroConflito } from '../erros.js';

export class ServicoProgressao {
  /**
   * @param {{ repositorioProgressao: object, repositorioAtributos: object,
   *   repositorioJogador: object, banco?: import('node:sqlite').DatabaseSync|null }} deps
   */
  constructor({ repositorioProgressao, repositorioAtributos, repositorioJogador, banco = null }) {
    this._progressao = repositorioProgressao;
    this._atributos = repositorioAtributos;
    this._jogadores = repositorioJogador;
    this._banco = banco;
  }

  _garantirJogador(jogadorId) {
    if (!this._jogadores.buscarPorId(jogadorId)) {
      throw new ErroConflito('Jogador não encontrado.');
    }
  }

  /** Monta a visão completa (progressão + atributos + progresso no nível). */
  _montarVisao(progressao, atributos) {
    const detalhe = calcularProgresso(progressao.xpTotal);
    return Object.freeze({
      jogadorId: progressao.jogadorId,
      xpTotal: progressao.xpTotal,
      nivel: progressao.nivel,
      pontosDisponiveis: progressao.pontosDisponiveis,
      atributos: Object.freeze({
        tecnologia: atributos.tecnologia,
        criatividade: atributos.criatividade,
        musica: atributos.musica,
        social: atributos.social,
        energia: atributos.energia,
        foco: atributos.foco,
        disciplina: atributos.disciplina,
      }),
      xpNoNivel: detalhe.xpNoNivel,
      xpNecessario: detalhe.xpNecessario,
      progresso: detalhe.progresso,
      criadoEm: progressao.criadoEm,
      atualizadoEm: progressao.atualizadoEm,
    });
  }

  /**
   * Cria a progressão inicial (chamado dentro da transação de criação do
   * jogador). Idempotente: se já existir, devolve o existente.
   */
  criarInicial(jogadorId) {
    const existente = this._progressao.buscarPorJogador(jogadorId);
    const atributosExistentes = this._atributos.buscarPorJogador(jogadorId);
    if (existente && atributosExistentes) {
      return this._montarVisao(existente, atributosExistentes);
    }
    const criar = () => {
      const prog = this._progressao.existe(jogadorId)
        ? this._progressao.buscarPorJogador(jogadorId)
        : this._progressao.criar(jogadorId, {
            xpTotal: XP_INICIAL,
            nivel: NIVEL_INICIAL,
            pontosDisponiveis: PONTOS_INICIAIS,
          });
      const atr = this._atributos.existe(jogadorId)
        ? this._atributos.buscarPorJogador(jogadorId)
        : this._atributos.criar(jogadorId, atributosIniciais());
      return this._montarVisao(prog, atr);
    };
    // Sem transação própria: o caminho principal é chamado DENTRO da
    // transação de criação do jogador (ServicoJogador.aoCriar — Fase 04/06),
    // e transações aninhadas são rejeitadas pelo SQLite. No caminho de
    // auto-inicialização (obter → jogador legado), as verificações `existe`
    // tornam a operação idempotente e reparável em chamadas seguintes.
    return criar();
  }

  /** Obtém a progressão; inicializa se o jogador veio de banco antigo. */
  obter(jogadorId) {
    this._garantirJogador(Number(jogadorId));
    const id = Number(jogadorId);
    const prog = this._progressao.buscarPorJogador(id);
    const atr = this._atributos.buscarPorJogador(id);
    if (prog && atr) return this._montarVisao(prog, atr);
    return this.criarInicial(id);
  }

  /**
   * Concede XP (operação interna/controlada — prepara futuras origens
   * MISSÃO/PROJETO/CONQUISTA/OUTRO sem implementar os módulos).
   * Zero não gera alteração; negativo é rejeitado pelo domínio.
   */
  adicionarXp(jogadorId, quantidade) {
    this._garantirJogador(Number(jogadorId));
    const id = Number(jogadorId);
    validarQuantidadeXp(Number(quantidade));
    const atual = this.obter(id);
    if (Number(quantidade) === 0) {
      return { ...atual, subiuNivel: false, niveisGanhos: 0 };
    }
    const calculado = adicionarXp(
      { xpTotal: atual.xpTotal, nivel: atual.nivel, pontosDisponiveis: atual.pontosDisponiveis },
      Number(quantidade),
    );
    const persistir = () => {
      const prog = this._progressao.atualizar(id, {
        xpTotal: calculado.xpTotal,
        nivel: calculado.nivel,
        pontosDisponiveis: calculado.pontosDisponiveis,
      });
      const atr = this._atributos.buscarPorJogador(id);
      return {
        ...this._montarVisao(prog, atr),
        subiuNivel: calculado.subiuNivel,
        niveisGanhos: calculado.niveisGanhos,
      };
    };
    const resultado = this._banco ? comTransacao(this._banco, persistir) : persistir();
    return Object.freeze(resultado);
  }

  /** Distribui pontos em um atributo (atômica: atributos + pontos). */
  aumentarAtributo(jogadorId, nome, quantidade = 1) {
    this._garantirJogador(Number(jogadorId));
    const id = Number(jogadorId);
    validarNomeAtributo(nome);
    const atual = this.obter(id);
    const calculado = aumentarAtributo(
      { atributos: atual.atributos, pontosDisponiveis: atual.pontosDisponiveis },
      nome,
      Number(quantidade),
    );
    const persistir = () => {
      this._atributos.atualizar(id, calculado.atributos);
      this._progressao.atualizar(id, {
        xpTotal: atual.xpTotal,
        nivel: atual.nivel,
        pontosDisponiveis: calculado.pontosDisponiveis,
      });
      const prog = this._progressao.buscarPorJogador(id);
      const atr = this._atributos.buscarPorJogador(id);
      return this._montarVisao(prog, atr);
    };
    return this._banco ? comTransacao(this._banco, persistir) : persistir();
  }
}
