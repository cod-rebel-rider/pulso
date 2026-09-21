/**
 * Testes de integração — Jogador (Fase 03 — Jogador)
 *
 * Cobre os testes da fase: criação, consulta, atualização, existência,
 * banco sem jogador, validação, persistência (fechar/abrir) e bloqueio de
 * múltiplos jogadores — sempre em banco temporário isolado.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inicializarBanco } from '../../src/core/database/inicializar.js';
import { MIGRACOES } from '../../src/core/database/migracoes.js';
import { RepositorioJogador } from '../../src/core/database/repositorios/jogador.js';
import { ServicoJogador } from '../../src/core/aplicacao/servico-jogador.js';
import { ErroValidacao, ErroConflito } from '../../src/core/erros.js';

function criarAmbiente() {
  const diretorio = mkdtempSync(join(tmpdir(), 'pulso-jogador-'));
  const estado = inicializarBanco({ diretorioDados: diretorio });
  const servico = new ServicoJogador({ repositorio: new RepositorioJogador(estado.banco) });
  return { diretorio, estado, servico };
}

function liberar(ambiente) {
  ambiente.estado.fechar();
  rmSync(ambiente.diretorio, { recursive: true, force: true });
}

test('criar jogador válido → jogador criado', () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servico.criar({ nome: '  Ana Rebel  ', codinome: ' echo ' });
    assert.equal(typeof jogador.id, 'number');
    assert.equal(jogador.nome, 'Ana Rebel', 'nome normalizado pelo domínio');
    assert.equal(jogador.codinome, 'echo');
    assert.ok(jogador.criadoEm);
    assert.ok(jogador.atualizadoEm);
  } finally {
    liberar(ambiente);
  }
});

test('recuperar jogador → dados corretos', () => {
  const ambiente = criarAmbiente();
  try {
    ambiente.servico.criar({ nome: 'Ana Rebel', codinome: 'echo' });
    const jogador = ambiente.servico.obter();
    assert.equal(jogador.nome, 'Ana Rebel');
    assert.equal(jogador.codinome, 'echo');
  } finally {
    liberar(ambiente);
  }
});

test('atualizar jogador → dados atualizados e atualizado_em alterado', async () => {
  const ambiente = criarAmbiente();
  try {
    const original = ambiente.servico.criar({ nome: 'Ana Rebel', codinome: 'echo' });
    await new Promise((r) => setTimeout(r, 10)); // garante carimbo de tempo distinto

    const atualizado = ambiente.servico.atualizar(original.id, { nome: 'Ana Prime', codinome: 'pr1me' });
    assert.equal(atualizado.nome, 'Ana Prime');
    assert.equal(atualizado.codinome, 'pr1me');
    assert.notEqual(atualizado.atualizadoEm, original.atualizadoEm, 'atualizado_em deve mudar');
    assert.equal(atualizado.criadoEm, original.criadoEm, 'criado_em é imutável');
    assert.equal(atualizado.id, original.id, 'a identidade interna não muda');
  } finally {
    liberar(ambiente);
  }
});

test('banco sem jogador → existe false e obter null (sem jogador fictício)', () => {
  const ambiente = criarAmbiente();
  try {
    assert.equal(ambiente.servico.existe(), false);
    assert.equal(ambiente.servico.obter(), null);
  } finally {
    liberar(ambiente);
  }
});

test('criar jogador com nome vazio → validação rejeita', () => {
  const ambiente = criarAmbiente();
  try {
    assert.throws(
      () => ambiente.servico.criar({ nome: '   ' }),
      (erro) => erro instanceof ErroValidacao && erro.campo === 'nome',
    );
    assert.equal(ambiente.servico.existe(), false, 'nada deve ser persistido');
  } finally {
    liberar(ambiente);
  }
});

test('persistência real: jogador sobrevive a fechar e reabrir a aplicação', () => {
  const ambiente = criarAmbiente();
  try {
    ambiente.servico.criar({ nome: 'Ana Rebel', codinome: 'echo' });
    ambiente.estado.fechar(); // "fechar a aplicação"

    const segundaExecucao = inicializarBanco({ diretorioDados: ambiente.diretorio });
    try {
      const servico2 = new ServicoJogador({
        repositorio: new RepositorioJogador(segundaExecucao.banco),
      });
      const jogador = servico2.obter();
      assert.equal(jogador.nome, 'Ana Rebel', 'nome exatamente como salvo');
      assert.equal(jogador.codinome, 'echo', 'codinome exatamente como salvo');
    } finally {
      segundaExecucao.fechar();
    }
  } finally {
    rmSync(ambiente.diretorio, { recursive: true, force: true });
  }
});

test('não é possível criar múltiplos jogadores (aplicação single-player)', () => {
  const ambiente = criarAmbiente();
  try {
    ambiente.servico.criar({ nome: 'Ana Rebel' });
    assert.throws(
      () => ambiente.servico.criar({ nome: 'Outro Jogador' }),
      (erro) => erro instanceof ErroConflito,
    );
    assert.equal(ambiente.servico.existe(), true);
    assert.equal(ambiente.servico.obter().nome, 'Ana Rebel', 'o jogador original permanece');
  } finally {
    liberar(ambiente);
  }
});

test('evolução: banco da Fase 02 recebe as migrações pendentes sem repetir anteriores', () => {
  const diretorio = mkdtempSync(join(tmpdir(), 'pulso-jogador-migracao-'));
  try {
    // banco "da Fase 02": apenas a migração 001 aplicada
    const faseAnterior = inicializarBanco({ diretorioDados: diretorio, migracoes: [MIGRACOES[0]] });
    faseAnterior.fechar();

    // aplicação atual aplica as migrações 002..013 (jogador, status, missões,
    // progressão, projetos, finanças, desejos, conciliação, serviços, contas,
    // recorrências e vínculo da geração)
    const atual = inicializarBanco({ diretorioDados: diretorio });
    try {
      assert.deepEqual(atual.migracoesAplicadas, [
        { versao: 2, nome: 'criar-tabela-jogador' },
        { versao: 3, nome: 'criar-tabela-status' },
        { versao: 4, nome: 'criar-tabela-missoes' },
        { versao: 5, nome: 'criar-tabelas-progressao' },
        { versao: 6, nome: 'criar-tabela-projetos' },
        { versao: 7, nome: 'criar-tabelas-financas' },
        { versao: 8, nome: 'criar-tabela-desejo' },
        { versao: 9, nome: 'conciliar-progressao-legado' },
        { versao: 10, nome: 'criar-tabela-servico' },
        { versao: 11, nome: 'criar-tabela-servico-conta' },
        { versao: 12, nome: 'criar-tabela-servico-recorrencia' },
        { versao: 13, nome: 'adicionar-recorrencia-id-em-servico-conta' },
        { versao: 14, nome: 'campos-de-pagamento-e-estado-paga-em-servico-conta' },
      ]);
      assert.equal(atual.versaoSchema, 14);

      // a tabela do jogador está disponível ao serviço
      const servico = new ServicoJogador({ repositorio: new RepositorioJogador(atual.banco) });
      assert.equal(servico.existe(), false);
    } finally {
      atual.fechar();
    }

    // banco já atualizado: nenhuma migração repetida
    const terceira = inicializarBanco({ diretorioDados: diretorio });
    try {
      assert.deepEqual(terceira.migracoesAplicadas, []);
      assert.equal(terceira.versaoSchema, 14);
    } finally {
      terceira.fechar();
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});
