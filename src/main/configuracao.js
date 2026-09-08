/**
 * PULSO — Carregador de configuração (Fase 01 — Fundação)
 *
 * Lê os arquivos de config/ separados por ambiente:
 *   desenvolvimento.json | teste.json | producao.json
 *
 * Nenhuma configuração sensível vive aqui (ver docs/regras-do-projeto.md).
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const raizProjeto = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const AMBIENTES = Object.freeze(['desenvolvimento', 'teste', 'producao']);

/**
 * Determina o ambiente atual:
 * 1. variável de ambiente PULSO_AMBIENTE (útil para testes);
 * 2. aplicativo empacotado → 'producao';
 * 3. padrão → 'desenvolvimento'.
 * @param {{ isPackaged?: boolean }} [estado] Estado do aplicativo Electron
 * @returns {string} 'desenvolvimento' | 'teste' | 'producao'
 */
export function determinarAmbiente({ isPackaged = false } = {}) {
  const peloAmbienteDeSistema = process.env.PULSO_AMBIENTE;
  if (peloAmbienteDeSistema) {
    if (!AMBIENTES.includes(peloAmbienteDeSistema)) {
      throw new Error(
        `PULSO_AMBIENTE inválido: "${peloAmbienteDeSistema}". Valores aceitos: ${AMBIENTES.join(', ')}.`,
      );
    }
    return peloAmbienteDeSistema;
  }
  return isPackaged ? 'producao' : 'desenvolvimento';
}

/**
 * Carrega e valida o arquivo de configuração do ambiente informado.
 * @param {string} ambiente 'desenvolvimento' | 'teste' | 'producao'
 * @returns {object} Configuração congelada do ambiente
 */
export function carregarConfiguracao(ambiente) {
  if (!AMBIENTES.includes(ambiente)) {
    throw new Error(`Ambiente desconhecido: "${ambiente}". Valores aceitos: ${AMBIENTES.join(', ')}.`);
  }
  const caminho = join(raizProjeto, 'config', `${ambiente}.json`);
  let bruto;
  try {
    bruto = readFileSync(caminho, 'utf-8');
  } catch (erro) {
    throw new Error(`Não foi possível ler a configuração "${caminho}": ${erro.message}`);
  }
  let config;
  try {
    config = JSON.parse(bruto);
  } catch (erro) {
    throw new Error(`A configuração "${ambiente}.json" não é um JSON válido: ${erro.message}`);
  }
  return validar(config, ambiente);
}

function validar(config, ambiente) {
  const obrigatorios = ['ambiente', 'idioma', 'depuracao', 'janela'];
  const faltando = obrigatorios.filter((campo) => config[campo] === undefined);
  if (faltando.length > 0) {
    throw new Error(
      `A configuração "${ambiente}.json" não declara os campos obrigatórios: ${faltando.join(', ')}.`,
    );
  }
  if (config.ambiente !== ambiente) {
    throw new Error(`A configuração "${ambiente}.json" declara o ambiente "${config.ambiente}".`);
  }
  if (config.idioma !== 'pt-BR') {
    throw new Error(`A configuração "${ambiente}.json" deve declarar o idioma "pt-BR".`);
  }
  if (typeof config.janela.largura !== 'number' || typeof config.janela.altura !== 'number') {
    throw new Error(`A configuração "${ambiente}.json" deve definir janela.largura e janela.altura numéricos.`);
  }
  return Object.freeze({ ...config, janela: Object.freeze({ ...config.janela }) });
}
