/**
 * PULSO — Testes de integração: Loja / Lista de Desejos (Fase 09)
 *
 * Cobertura: criação, edição, persistência, máquina de estados,
 * comparacao esperado x real, compra (despesa + saldo + status),
 * atomicidade, historico, cancelamento e resumo — com SQLite real.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { aplicarMigracoes } from '../../src/core/database/migracoes.js';
import { RepositorioJogador } from '../../src/core/database/repositorios/jogador.js';
import { RepositorioCarteira } from '../../src/core/database/repositorios/carteira.js';
import { RepositorioTransacao } from '../../src/core/database/repositorios/transacao.js';
import { RepositorioOrcamento } from '../../src/core/database/repositorios/orcamento.js';
import { RepositorioDesejo } from '../../src/core/database/repositorios/desejo.js';
import { ServicoFinanca } from '../../src/core/aplicacao/servico-financa.js';
import { ServicoLoja } from '../../src/core/aplicacao/servico-loja.js';
import { ServicoJogador } from '../../src/core/aplicacao/servico-jogador.js';
import { ErroValidacao, ErroConflito, ErroTransicao } from '../../src/core/erros.js';

/**
 * Cria um ambiente isolado: banco temporario + servicos (financas e loja
 * compartilham a MESMA conexao — a compra usa o motor da Fase 08).
 */
function criarAmbiente() {
  const dir = mkdtempSync(join(tmpdir(), 'pulso-loja-'));
  const db = new DatabaseSync(join(dir, 'pulso.db'));
  db.exec('PRAGMA foreign_keys = ON');
  aplicarMigracoes(db);

  const repositorioJogador = new RepositorioJogador(db);
  const servicoFinanca = new ServicoFinanca({
    repositorioCarteira: new RepositorioCarteira(db),
    repositorioTransacao: new RepositorioTransacao(db),
    repositorioOrcamento: new RepositorioOrcamento(db),
    repositorioJogador,
  });
  const servicoJogador = new ServicoJogador({
    repositorio: repositorioJogador,
    banco: db,
    aoCriar: (j) => servicoFinanca.criarCarteiraInicial(j.id),
  });
  const servicoLoja = new ServicoLoja({
    repositorio: new RepositorioDesejo(db),
    repositorioJogador,
    servicoFinanca,
    banco: db,
  });
  return { dir, db, servicoJogador, servicoFinanca, servicoLoja };
}

function liberar({ dir, db }) {
  try {
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('desejo: criar item nao movimenta carteira e nao cria transacao', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Teste Loja' });
    const desejo = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'SSD NVMe 1 TB',
      descricao: 'Upgrade do notebook',
      categoria: 'tecnologia',
      prioridade: 'alta',
      precoEsperado: 45000,
    });
    assert.ok(desejo.id);
    assert.equal(desejo.estado, 'desejado');
    assert.equal(desejo.precoEsperado, 45000);
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 0);
    assert.equal(ambiente.servicoFinanca.listarTransacoes(jogador.id).length, 0);
  } finally {
    liberar(ambiente);
  }
});

test('desejo: editar preco esperado persiste os novos valores', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Edicao' });
    const criado = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'SSD',
      categoria: 'tecnologia',
      precoEsperado: 50000,
    });
    const editado = ambiente.servicoLoja.atualizar(criado.id, { precoEsperado: 45000 });
    assert.equal(editado.precoEsperado, 45000);
    assert.equal(editado.titulo, 'SSD');
    assert.equal(ambiente.servicoLoja.obter(criado.id).precoEsperado, 45000);
  } finally {
    liberar(ambiente);
  }
});

test('desejo: validacoes rejeitam nome vazio e preco invalido', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Validacao' });
    assert.throws(
      () => ambiente.servicoLoja.criar(jogador.id, { titulo: '', categoria: 'casa', precoEsperado: 100 }),
      ErroValidacao,
    );
    assert.throws(
      () => ambiente.servicoLoja.criar(jogador.id, { titulo: 'X', categoria: 'casa', precoEsperado: 0 }),
      ErroValidacao,
    );
    assert.throws(
      () => ambiente.servicoLoja.criar(jogador.id, { titulo: 'X', categoria: 'nao-existe', precoEsperado: 100 }),
      ErroValidacao,
    );
    assert.throws(() => ambiente.servicoLoja.criar(99999, { titulo: 'X', categoria: 'casa', precoEsperado: 100 }), ErroConflito);
    assert.throws(() => ambiente.servicoLoja.obter(99999), ErroConflito);
  } finally {
    liberar(ambiente);
  }
});

test('estados: transicoes guiadas e cancelamento', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Estados' });
    const criado = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'Camiseta',
      categoria: 'vestuario',
      prioridade: 'baixa',
      precoEsperado: 12000,
    });
    const analisado = ambiente.servicoLoja.analisar(criado.id);
    assert.equal(analisado.estado, 'em_analise');
    const planejado = ambiente.servicoLoja.planejar(criado.id);
    assert.equal(planejado.estado, 'planejado');
    const cancelado = ambiente.servicoLoja.cancelar(criado.id);
    assert.equal(cancelado.estado, 'cancelado');
    // cancelado permanece no banco, sem transacao, sem movimento na carteira
    assert.equal(ambiente.servicoLoja.obter(criado.id).estado, 'cancelado');
    assert.equal(ambiente.servicoFinanca.listarTransacoes(jogador.id).length, 0);
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 0);
  } finally {
    liberar(ambiente);
  }
});

test('estados: DESEJADO -> PLANEJADO via atalho guiado e transicoes invalidas bloqueadas', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Atalho' });
    const criado = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'Teclado',
      categoria: 'tecnologia',
      precoEsperado: 30000,
    });
    const planejado = ambiente.servicoLoja.planejar(criado.id);
    assert.equal(planejado.estado, 'planejado');
    // bloquear comprar direto de desejado
    const novo = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'Mouse',
      categoria: 'tecnologia',
      precoEsperado: 10000,
    });
    assert.throws(() => ambiente.servicoLoja.comprar(novo.id, { precoFinal: 9000 }), ErroTransicao);
  } finally {
    liberar(ambiente);
  }
});

test('compra: registra despesa pelo preco REAL, atualiza saldo e status, vincula transacao', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Compra' });
    ambiente.servicoFinanca.criarTransacao(jogador.id, {
      tipo: 'receita',
      valorCentavos: 100000,
      categoria: 'salario',
      data: '2026-09-01',
    });
    const desejo = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'SSD NVMe 1 TB',
      categoria: 'tecnologia',
      prioridade: 'alta',
      precoEsperado: 45000,
    });
    ambiente.servicoLoja.planejar(desejo.id);

    const comprado = ambiente.servicoLoja.comprar(desejo.id, {
      precoFinal: 39990,
      data: '2026-09-12',
      observacao: 'Promocao',
    });
    assert.equal(comprado.estado, 'comprado');
    assert.equal(comprado.precoFinal, 39990);
    assert.equal(comprado.diferencaCentavos, -5010);
    assert.equal(comprado.percentual, -11.13);
    assert.equal(comprado.dataCompra, '2026-09-12');
    assert.ok(comprado.transacaoId, 'compra deve referenciar a transacao financeira');

    const transacoes = ambiente.servicoFinanca.listarTransacoes(jogador.id);
    assert.equal(transacoes.length, 2);
    const despesa = transacoes.find((t) => t.tipo === 'despesa');
    assert.ok(despesa);
    assert.equal(despesa.valorCentavos, 39990, 'despesa usa o preco REAL, nao o esperado');
    assert.equal(despesa.categoria, 'tecnologia');
    assert.equal(despesa.descricao, 'Compra: SSD NVMe 1 TB');
    assert.equal(despesa.ocorridaEm, '2026-09-12');
    assert.equal(despesa.id, comprado.transacaoId);

    // saldo reduzido pelo valor real: 100000 - 39990 = 60010
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 60010);
  } finally {
    liberar(ambiente);
  }
});

test('compra: tentar comprar item ja comprado e bloqueado', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Duplicar' });
    const desejo = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'Fone',
      categoria: 'musica',
      precoEsperado: 20000,
    });
    ambiente.servicoLoja.planejar(desejo.id);
    ambiente.servicoLoja.comprar(desejo.id, { precoFinal: 18000 });
    assert.throws(
      () => ambiente.servicoLoja.comprar(desejo.id, { precoFinal: 18000 }),
      ErroTransicao,
    );
    const despesas = ambiente.servicoFinanca
      .listarTransacoes(jogador.id)
      .filter((t) => t.tipo === 'despesa');
    assert.equal(despesas.length, 1);
  } finally {
    liberar(ambiente);
  }
});

test('compra: saldo negativo e permitido (regra da Fase 08)', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Negativo' });
    const desejo = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'Guitarra',
      categoria: 'musica',
      precoEsperado: 150000,
    });
    ambiente.servicoLoja.planejar(desejo.id);
    const comprado = ambiente.servicoLoja.comprar(desejo.id, { precoFinal: 150000 });
    assert.equal(comprado.estado, 'comprado');
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, -150000);
  } finally {
    liberar(ambiente);
  }
});
test('compra: atomicidade — falha apos criar a despesa reverte tudo (ROLLBACK)', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Atomica' });
    ambiente.servicoFinanca.criarTransacao(jogador.id, {
      tipo: 'receita',
      valorCentavos: 90000,
      categoria: 'salario',
      data: '2026-09-01',
    });
    const desejo = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'Monitor',
      categoria: 'tecnologia',
      precoEsperado: 80000,
    });
    ambiente.servicoLoja.planejar(desejo.id);

    // envolve o servico financeiro real: cria a despesa e depois falha
    const servicoLojaQuebrado = new ServicoLoja({
      repositorio: new RepositorioDesejo(ambiente.db),
      repositorioJogador: new RepositorioJogador(ambiente.db),
      servicoFinanca: {
        ...ambiente.servicoFinanca,
        criarTransacao(jogadorId, dados) {
          const transacao = ambiente.servicoFinanca.criarTransacao(jogadorId, dados);
          throw new Error('falha simulada apos criar a despesa');
        },
      },
      banco: ambiente.db,
    });

    assert.throws(
      () => servicoLojaQuebrado.comprar(desejo.id, { precoFinal: 77000 }),
      /falha simulada/,
    );

    // ROLLBACK: nenhuma despesa, desejo continua planejado, saldo intacto
    const transacoes = ambiente.servicoFinanca.listarTransacoes(jogador.id);
    assert.equal(transacoes.length, 1, 'despesa criada deve ser revertida');
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 90000);
    assert.equal(ambiente.servicoLoja.obter(desejo.id).estado, 'planejado');
  } finally {
    liberar(ambiente);
  }
});

test('historico: compras listadas mesmo com item cancelado/outros itens', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Historico' });
    const a = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'Item A',
      categoria: 'tecnologia',
      precoEsperado: 10000,
    });
    const b = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'Item B',
      categoria: 'lazer',
      precoEsperado: 5000,
    });
    ambiente.servicoLoja.planejar(a.id);
    ambiente.servicoLoja.planejar(b.id);
    ambiente.servicoLoja.comprar(a.id, { precoFinal: 9000, data: '2026-09-10' });
    ambiente.servicoLoja.comprar(b.id, { precoFinal: 5500, data: '2026-09-11' });
    const c = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'Item C',
      categoria: 'outros',
      precoEsperado: 1000,
    });
    ambiente.servicoLoja.cancelar(c.id);

    const compras = ambiente.servicoLoja.listarComprados(jogador.id);
    assert.equal(compras.length, 2);
    assert.equal(compras[0].titulo, 'Item B', 'ordenado por data DESC');
    assert.equal(compras[1].titulo, 'Item A');

    // todos os itens permanecem no banco (incluindo cancelado)
    assert.equal(ambiente.servicoLoja.listar(jogador.id).length, 3);
  } finally {
    liberar(ambiente);
  }
});

test('persistencia: desejos sobrevivem a fechar e reabrir o banco', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pulso-loja-persist-'));
  try {
    let db = new DatabaseSync(join(dir, 'pulso.db'));
    db.exec('PRAGMA foreign_keys = ON');
    aplicarMigracoes(db);
    const repositorioJogador = new RepositorioJogador(db);
    const financa = new ServicoFinanca({
      repositorioCarteira: new RepositorioCarteira(db),
      repositorioTransacao: new RepositorioTransacao(db),
      repositorioOrcamento: new RepositorioOrcamento(db),
      repositorioJogador,
    });
    const servicoJogador = new ServicoJogador({
      repositorio: repositorioJogador,
      banco: db,
      aoCriar: (j) => financa.criarCarteiraInicial(j.id),
    });
    const loja = new ServicoLoja({
      repositorio: new RepositorioDesejo(db),
      repositorioJogador,
      servicoFinanca: financa,
      banco: db,
    });
    const jogador = servicoJogador.criar({ nome: 'Persistente' });
    const desejo = loja.criar(jogador.id, {
      titulo: 'SSD NVMe',
      categoria: 'tecnologia',
      prioridade: 'alta',
      precoEsperado: 45000,
    });
    loja.planejar(desejo.id);
    loja.comprar(desejo.id, { precoFinal: 39990, data: '2026-09-12' });
    db.close();

    // reabre o MESMO arquivo
    db = new DatabaseSync(join(dir, 'pulso.db'));
    db.exec('PRAGMA foreign_keys = ON');
    const repositorioJogador2 = new RepositorioJogador(db);
    const financa2 = new ServicoFinanca({
      repositorioCarteira: new RepositorioCarteira(db),
      repositorioTransacao: new RepositorioTransacao(db),
      repositorioOrcamento: new RepositorioOrcamento(db),
      repositorioJogador: repositorioJogador2,
    });
    const loja2 = new ServicoLoja({
      repositorio: new RepositorioDesejo(db),
      repositorioJogador: repositorioJogador2,
      servicoFinanca: financa2,
      banco: db,
    });
    const relido = loja2.obter(desejo.id);
    assert.equal(relido.estado, 'comprado');
    assert.equal(relido.precoEsperado, 45000);
    assert.equal(relido.precoFinal, 39990);
    assert.equal(relido.percentual, -11.13);
    assert.equal(loja2.listarComprados(jogador.id).length, 1);
    assert.equal(financa2.obterCarteira(jogador.id).saldo, -39990);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('edicao: item comprado ou cancelado nao pode ser editado', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Imutavel' });
    const a = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'A',
      categoria: 'casa',
      precoEsperado: 10000,
    });
    ambiente.servicoLoja.planejar(a.id);
    ambiente.servicoLoja.comprar(a.id, { precoFinal: 9000 });
    assert.throws(() => ambiente.servicoLoja.atualizar(a.id, { titulo: 'Novo' }), ErroValidacao);

    const b = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'B',
      categoria: 'casa',
      precoEsperado: 10000,
    });
    ambiente.servicoLoja.cancelar(b.id);
    assert.throws(() => ambiente.servicoLoja.atualizar(b.id, { precoEsperado: 5000 }), ErroValidacao);
    assert.throws(() => ambiente.servicoLoja.comprar(b.id, { precoFinal: 9000 }), ErroTransicao);
  } finally {
    liberar(ambiente);
  }
});

test('resumo: ativos, planejados, comprados, valor estimado e economia', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: 'Resumo' });
    const a = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'A',
      categoria: 'tecnologia',
      precoEsperado: 10000,
    });
    const b = ambiente.servicoLoja.criar(jogador.id, {
      titulo: 'B',
      categoria: 'lazer',
      precoEsperado: 20000,
    });
    ambiente.servicoLoja.planejar(a.id);
    ambiente.servicoLoja.planejar(b.id);
    ambiente.servicoLoja.comprar(a.id, { precoFinal: 8000 });

    const resumo = ambiente.servicoLoja.resumo(jogador.id);
    assert.equal(resumo.ativos, 1); // b ainda planejado
    assert.equal(resumo.planejados, 1);
    assert.equal(resumo.comprados, 1);
    assert.equal(resumo.valorEstimado, 20000);
    assert.equal(resumo.economiaHistorica, 2000); // 10000 - 8000
  } finally {
    liberar(ambiente);
  }
});
