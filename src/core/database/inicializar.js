/**
 * PULSO — Inicialização do banco de dados (Fase 02 — Banco de Dados)
 *
 * Fluxo da inicialização:
 *
 *   localizar/criar arquivo → conectar (PRAGMAs) → migrar → validar → devolver
 *
 * O diretório de dados SEMPRE chega de fora (main.js obtém via Electron,
 * testes usam diretórios temporários) — este módulo nunca resolve caminho
 * de máquina e nunca importa Electron (núcleo testável isolado).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { abrirConexao, fecharConexao, verificarIntegridade } from './conexao.js';
import { aplicarMigracoes, versaoAtual, MIGRACOES } from './migracoes.js';

export const NOME_ARQUIVO_BANCO = 'pulso.db';

/**
 * Inicializa o banco do PULSO.
 * @param {{
 *   diretorioDados: string,
 *   nomeArquivo?: string,
 *   migracoes?: Array
 * }} parametros `diretorioDados` é obrigatório e dinâmico (ex.: userData).
 * @returns {{
 *   banco: import('node:sqlite').DatabaseSync,
 *   caminho: string,
 *   criado: boolean,
 *   versaoSchema: number,
 *   migracoesAplicadas: Array<{versao: number, nome: string}>,
 *   fechar: () => void
 * }}
 */
export function inicializarBanco({ diretorioDados, nomeArquivo = NOME_ARQUIVO_BANCO, migracoes = MIGRACOES }) {
  if (!diretorioDados) {
    throw new Error('inicializarBanco: "diretorioDados" é obrigatório.');
  }

  const caminho = join(diretorioDados, nomeArquivo);
  const criado = !existsSync(caminho);
  const banco = abrirConexao({ caminho });

  try {
    const { aplicadas } = aplicarMigracoes(banco, migracoes);

    const integridade = verificarIntegridade(banco);
    if (!integridade.ok) {
      throw new Error(`Banco inconsistente após inicialização: ${integridade.problemas.join('; ')}`);
    }

    return {
      banco,
      caminho,
      criado,
      versaoSchema: versaoAtual(banco),
      migracoesAplicadas: aplicadas,
      fechar() {
        fecharConexao(banco);
      },
    };
  } catch (erro) {
    try {
      fecharConexao(banco);
    } catch {
      // preserva o erro original da inicialização
    }
    throw erro;
  }
}
