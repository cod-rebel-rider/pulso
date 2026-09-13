/**
 * PULSO — Homologação: ambiente isolado de testes.
 *
 * Todos os testes de homologação usam bancos SQLite temporários
 * (mkdtemp + DatabaseSync + aplicarMigracoes) e nunca tocam no banco
 * real do usuário (~/.config/pulso/pulso.db).
 *
 * Após a execução, o diretório temporário é removido (rmSync).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { aplicarMigracoes } from '../../src/core/database/migracoes.js';
import { RepositorioJogador } from '../../src/core/database/repositorios/jogador.js';
import { RepositorioStatus } from '../../src/core/database/repositorios/status.js';
import { RepositorioMissao } from '../../src/core/database/repositorios/missao.js';
import { RepositorioProgressao } from '../../src/core/database/repositorios/progressao.js';
import { RepositorioAtributos } from '../../src/core/database/repositorios/atributos.js';
import { RepositorioProjeto } from '../../src/core/database/repositorios/projeto.js';
import { RepositorioCarteira } from '../../src/core/database/repositorios/carteira.js';
import { RepositorioTransacao } from '../../src/core/database/repositorios/transacao.js';
import { RepositorioOrcamento } from '../../src/core/database/repositorios/orcamento.js';
import { ServicoJogador } from '../../src/core/aplicacao/servico-jogador.js';
import { ServicoStatus } from '../../src/core/aplicacao/servico-status.js';
import { ServicoMissao } from '../../src/core/aplicacao/servico-missao.js';
import { ServicoProgressao } from '../../src/core/aplicacao/servico-progressao.js';
import { ServicoProjeto } from '../../src/core/aplicacao/servico-projeto.js';
import { ServicoFinanca } from '../../src/core/aplicacao/servico-financa.js';

let contador = 0;

/** Cria um banco temporário migrado até a versão atual (v7). */
export function criarBancoTemporario(prefixo = 'pulso-homolog-') {
  const diretorio = mkdtempSync(join(tmpdir(), `${prefixo}${process.pid}-${Date.now()}-${contador++}-`));
  const banco = new DatabaseSync(join(diretorio, 'pulso.db'));
  banco.exec('PRAGMA foreign_keys = ON');
  aplicarMigracoes(banco);
  return { diretorio, banco };
}

/** Remove banco temporário (fecha + apaga diretório). */
export function destruirBancoTemporario({ diretorio, banco }) {
  try {
    banco.close();
  } catch {
    // já fechado (testes de persistência fecham no meio) — segue para limpeza
  }
  rmSync(diretorio, { recursive: true, force: true });
}

/**
 * Monta todos os repositórios + serviços ligados ao banco informado,
 * reproduzindo a fiação de src/main/main.js (criação atômica:
 * jogador + status + progressão + carteira na mesma transação).
 */
export function criarServicos(banco) {
  const repositorioJogador = new RepositorioJogador(banco);
  const repositorioStatus = new RepositorioStatus(banco);
  const repositorioMissao = new RepositorioMissao(banco);
  const repositorioProgressao = new RepositorioProgressao(banco);
  const repositorioAtributos = new RepositorioAtributos(banco);
  const repositorioProjeto = new RepositorioProjeto(banco);
  const repositorioCarteira = new RepositorioCarteira(banco);
  const repositorioTransacao = new RepositorioTransacao(banco);
  const repositorioOrcamento = new RepositorioOrcamento(banco);

  const servicoStatus = new ServicoStatus({ repositorio: repositorioStatus, repositorioJogador });
  const servicoProgressao = new ServicoProgressao({
    repositorioProgressao,
    repositorioAtributos,
    repositorioJogador,
    banco,
  });
  const servicoFinanca = new ServicoFinanca({
    repositorioCarteira,
    repositorioTransacao,
    repositorioOrcamento,
    repositorioJogador,
  });
  const servicoJogador = new ServicoJogador({
    repositorio: repositorioJogador,
    banco,
    aoCriar: (jogador) => {
      servicoStatus.criarInicial(jogador.id);
      servicoProgressao.criarInicial(jogador.id);
      servicoFinanca.criarCarteiraInicial(jogador.id);
    },
  });
  const servicoMissao = new ServicoMissao({ repositorio: repositorioMissao });
  const servicoProjeto = new ServicoProjeto({
    repositorio: repositorioProjeto,
    repositorioMissao,
    repositorioJogador,
  });

  return {
    repositorioJogador,
    repositorioStatus,
    repositorioMissao,
    repositorioProgressao,
    repositorioAtributos,
    repositorioProjeto,
    repositorioCarteira,
    repositorioTransacao,
    repositorioOrcamento,
    servicoJogador,
    servicoStatus,
    servicoMissao,
    servicoProgressao,
    servicoProjeto,
    servicoFinanca,
  };
}

/** Atalho: banco + serviços + jogador padrão. */
export function criarMundoTeste(nome = 'Homologação', codinome = 'homolog') {
  const ambiente = criarBancoTemporario();
  const servicos = criarServicos(ambiente.banco);
  const jogador = servicos.servicoJogador.criar({ nome, codinome });
  return { ...ambiente, ...servicos, jogador };
}
