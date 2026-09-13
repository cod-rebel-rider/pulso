/**
 * PULSO — Testes unitarios: dominio da Loja / Lista de Desejos (Fase 09)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIAS_DESEJO,
  ROTULO_CATEGORIA_DESEJO,
  validarCategoriaDesejo,
  PRIORIDADES_DESEJO,
  PRIORIDADES_DESEJO_ORDEM,
  PRIORIDADES_DESEJO_ROTULOS,
  PRIORIDADE_DESEJO_PADRAO,
  validarPrioridadeDesejo,
  ESTADOS_DESEJO,
  ESTADOS_DESEJO_ORDEM,
  ESTADOS_DESEJO_ROTULOS,
  ESTADO_DESEJO_INICIAL,
  validarEstadoDesejo,
  transicaoDesejoPermitida,
  exigirTransicaoDesejo,
  desejoFinal,
  desejoAtivo,
  validarTituloDesejo,
  validarDescricaoDesejo,
  validarPrecoEsperado,
  validarPrecoFinal,
  validarObservacaoCompra,
  validarDataCompra,
  validarDesejoCriacao,
  validarDesejoEdicao,
  validarCompraDesejo,
  calcularDiferencaCompra,
  categoriaFinanceiraDoDesejo,
  descricaoTransacaoCompra,
  paraDesejo,
} from '../../src/core/dominio/loja.js';
import { ErroValidacao, ErroTransicao } from '../../src/core/erros.js';

// ---- Categorias ----
test('categorias do desejo: lista controlada com rotulos', () => {
  assert.deepEqual(
    CATEGORIAS_DESEJO.map((c) => c.valor),
    [
      'tecnologia', 'musica', 'vestuario', 'casa', 'transporte',
      'educacao', 'lazer', 'trabalho', 'hobby', 'outros',
    ],
  );
  assert.equal(ROTULO_CATEGORIA_DESEJO.tecnologia, 'TECNOLOGIA');
  assert.equal(validarCategoriaDesejo('tecnologia'), 'tecnologia');
  assert.throws(() => validarCategoriaDesejo('inexistente'), ErroValidacao);
  assert.throws(() => validarCategoriaDesejo(null), ErroValidacao);
});

// ---- Prioridades ----
test('prioridades do desejo: BAIXA/NORMAL/ALTA/CRITICA com padrao NORMAL', () => {
  assert.deepEqual(PRIORIDADES_DESEJO_ORDEM, ['baixa', 'normal', 'alta', 'critica']);
  assert.equal(PRIORIDADE_DESEJO_PADRAO, 'normal');
  assert.equal(PRIORIDADES_DESEJO_ROTULOS.alta, 'Alta');
  assert.equal(validarPrioridadeDesejo(PRIORIDADES_DESEJO.CRITICA), 'critica');
  assert.throws(() => validarPrioridadeDesejo('urgente'), ErroValidacao);
});

// ---- Estados e transicoes ----
test('estados do desejo: rotulos, ordem e estado inicial', () => {
  assert.deepEqual(ESTADOS_DESEJO_ORDEM, [
    'desejado', 'em_analise', 'planejado', 'comprado', 'cancelado',
  ]);
  assert.equal(ESTADO_DESEJO_INICIAL, 'desejado');
  assert.equal(ESTADOS_DESEJO_ROTULOS.planejado, 'Planejado');
  assert.throws(() => validarEstadoDesejo('vazio'), ErroValidacao);
});

test('transicoes validas do desejo', () => {
  assert.equal(transicaoDesejoPermitida('desejado', 'em_analise'), true);
  assert.equal(transicaoDesejoPermitida('desejado', 'cancelado'), true);
  assert.equal(transicaoDesejoPermitida('em_analise', 'planejado'), true);
  assert.equal(transicaoDesejoPermitida('em_analise', 'cancelado'), true);
  assert.equal(transicaoDesejoPermitida('planejado', 'comprado'), true);
  assert.equal(transicaoDesejoPermitida('planejado', 'cancelado'), true);
});

test('transicoes invalidas do desejo sao bloqueadas', () => {
  assert.equal(transicaoDesejoPermitida('desejado', 'planejado'), false);
  assert.equal(transicaoDesejoPermitida('desejado', 'comprado'), false);
  assert.equal(transicaoDesejoPermitida('em_analise', 'comprado'), false);
  assert.equal(transicaoDesejoPermitida('comprado', 'cancelado'), false);
  assert.equal(transicaoDesejoPermitida('cancelado', 'planejado'), false);
  assert.equal(transicaoDesejoPermitida('comprado', 'desejado'), false);
  assert.throws(() => exigirTransicaoDesejo('comprado', 'cancelado'), ErroTransicao);
});

test('estados finais e ativos do desejo', () => {
  assert.equal(desejoFinal('comprado'), true);
  assert.equal(desejoFinal('cancelado'), true);
  assert.equal(desejoFinal('planejado'), false);
  assert.equal(desejoAtivo('desejado'), true);
  assert.equal(desejoAtivo('em_analise'), true);
  assert.equal(desejoAtivo('planejado'), true);
  assert.equal(desejoAtivo('comprado'), false);
  assert.equal(desejoAtivo('cancelado'), false);
});
// ---- Validacao de campos ----
test('titulo do desejo: obrigatorio e com limite', () => {
  assert.throws(() => validarTituloDesejo(''), ErroValidacao);
  assert.throws(() => validarTituloDesejo('   '), ErroValidacao);
  assert.throws(() => validarTituloDesejo(null), ErroValidacao);
  assert.throws(() => validarTituloDesejo('a'.repeat(121)), ErroValidacao);
  assert.equal(validarTituloDesejo(' SSD NVMe '), 'SSD NVMe');
});

test('descricao e observacao opcionais com limite', () => {
  assert.equal(validarDescricaoDesejo(null), null);
  assert.equal(validarDescricaoDesejo(''), null);
  assert.equal(validarDescricaoDesejo('Upgrade'), 'Upgrade');
  assert.throws(() => validarDescricaoDesejo('a'.repeat(2001)), ErroValidacao);
  assert.throws(() => validarObservacaoCompra('a'.repeat(501)), ErroValidacao);
  assert.equal(validarObservacaoCompra('Na loja X'), 'Na loja X');
});

test('precos: inteiros positivos em centavos (regra da Fase 08)', () => {
  assert.equal(validarPrecoEsperado(100), 100);
  assert.equal(validarPrecoEsperado(120000), 120000);
  assert.equal(validarPrecoEsperado(39990), 39990);
  assert.throws(() => validarPrecoEsperado(0), ErroValidacao);
  assert.throws(() => validarPrecoEsperado(-500), ErroValidacao);
  assert.throws(() => validarPrecoEsperado(12.99), ErroValidacao);
  assert.throws(() => validarPrecoEsperado('45000'), ErroValidacao);
  assert.throws(() => validarPrecoEsperado(null), ErroValidacao);
  assert.throws(() => validarPrecoFinal(0), ErroValidacao);
  assert.throws(() => validarPrecoFinal(-1), ErroValidacao);
});

test('data da compra: formato AAAA-MM-DD valido ou null', () => {
  assert.equal(validarDataCompra('2026-09-12'), '2026-09-12');
  assert.equal(validarDataCompra(null), null);
  assert.equal(validarDataCompra(''), null);
  assert.throws(() => validarDataCompra('12/09/2026'), ErroValidacao);
  assert.throws(() => validarDataCompra('2026-13-40'), ErroValidacao);
  assert.throws(() => validarDataCompra(20260912), ErroValidacao);
});

test('criacao do desejo: campos validados', () => {
  const criado = validarDesejoCriacao({
    titulo: 'Controladora MIDI',
    descricao: 'Para estudar',
    categoria: 'musica',
    prioridade: 'alta',
    precoEsperado: 120000,
  });
  assert.equal(criado.titulo, 'Controladora MIDI');
  assert.equal(criado.categoria, 'musica');
  assert.equal(criado.prioridade, 'alta');
  assert.equal(criado.precoEsperado, 120000);

  assert.throws(
    () => validarDesejoCriacao({ titulo: 'X', categoria: 'inexistente', precoEsperado: 100 }),
    ErroValidacao,
  );
  assert.throws(
    () => validarDesejoCriacao({ titulo: 'X', categoria: 'casa', precoEsperado: 0 }),
    ErroValidacao,
  );
  assert.throws(
    () => validarDesejoCriacao({ titulo: '', categoria: 'casa', precoEsperado: 100 }),
    ErroValidacao,
  );
});

test('edicao do desejo: campos parciais', () => {
  const editado = validarDesejoEdicao({ precoEsperado: 45000 });
  assert.equal(editado.precoEsperado, 45000);
  assert.deepEqual(Object.keys(validarDesejoEdicao({})), []);
  assert.throws(() => validarDesejoEdicao({ prioridade: 'maxima' }), ErroValidacao);
});

test('compra do desejo: preco final, data e observacao validados', () => {
  const compra = validarCompraDesejo({ precoFinal: 39990, data: '2026-09-12' });
  assert.equal(compra.precoFinal, 39990);
  assert.equal(compra.data, '2026-09-12');
  assert.equal(compra.observacao, null);
  assert.throws(() => validarCompraDesejo({ precoFinal: 0 }), ErroValidacao);
  assert.throws(() => validarCompraDesejo({ precoFinal: '39990' }), ErroValidacao);
});
// ---- Comparacao esperado x real ----
test('comparacao: esperado 1000, pago 900 -> economia -100 (-10%)', () => {
  const resultado = calcularDiferencaCompra(1000, 900);
  assert.equal(resultado.diferencaCentavos, -100);
  assert.equal(resultado.percentual, -10);
});

test('comparacao: esperado 1000, pago 1100 -> diferenca +100 (+10%)', () => {
  const resultado = calcularDiferencaCompra(1000, 1100);
  assert.equal(resultado.diferencaCentavos, 100);
  assert.equal(resultado.percentual, 10);
});

test('comparacao: preco esperado invalido/zero e rejeitado (divisao indefinida)', () => {
  assert.throws(() => calcularDiferencaCompra(0, 100), ErroValidacao);
  assert.throws(() => calcularDiferencaCompra(-100, 100), ErroValidacao);
});

test('comparacao: precos iguais -> diferenca zero', () => {
  const resultado = calcularDiferencaCompra(45000, 45000);
  assert.equal(resultado.diferencaCentavos, 0);
  assert.equal(resultado.percentual, 0);
});

// ---- Conversor linha -> objeto ----
test('paraDesejo: converte linha do banco em objeto camelCase', () => {
  const desejo = paraDesejo({
    id: 1,
    jogador_id: 1,
    titulo: 'SSD NVMe',
    descricao: 'Upgrade',
    categoria: 'tecnologia',
    prioridade: 'alta',
    estado: 'comprado',
    valor_esperado_centavos: 45000,
    valor_pago_centavos: 39990,
    diferenca_centavos: -5010,
    data_compra: '2026-09-12',
    observacao_compra: null,
    transacao_id: 9,
    criado_em: '2026-09-01T10:00:00.000Z',
    atualizado_em: '2026-09-12T10:00:00.000Z',
    comprado_em: '2026-09-12T10:00:00.000Z',
  });
  assert.equal(desejo.id, 1);
  assert.equal(desejo.precoEsperado, 45000);
  assert.equal(desejo.precoFinal, 39990);
  assert.equal(desejo.diferencaCentavos, -5010);
  assert.equal(desejo.percentual, -11.13);
  assert.equal(desejo.transacaoId, 9);
  assert.equal(desejo.dataCompra, '2026-09-12');
});

test('paraDesejo: sem compra -> campos nulos e percentual nulo', () => {
  const desejo = paraDesejo({
    id: 2,
    jogador_id: 1,
    titulo: 'Camiseta',
    descricao: null,
    categoria: 'vestuario',
    prioridade: 'baixa',
    estado: 'desejado',
    valor_esperado_centavos: 12000,
    valor_pago_centavos: null,
    diferenca_centavos: null,
    data_compra: null,
    observacao_compra: null,
    transacao_id: null,
    criado_em: '2026-09-01T10:00:00.000Z',
    atualizado_em: '2026-09-01T10:00:00.000Z',
    comprado_em: null,
  });
  assert.equal(desejo.precoFinal, null);
  assert.equal(desejo.diferencaCentavos, null);
  assert.equal(desejo.percentual, null);
  assert.equal(paraDesejo(null), null);
});

// ---- Integracao com categorias financeiras (Fase 08) ----
test('categoria financeira: desejo traduz para despesa existente da Fase 08', () => {
  assert.equal(categoriaFinanceiraDoDesejo('tecnologia'), 'tecnologia');
  assert.equal(categoriaFinanceiraDoDesejo('musica'), 'musica');
  assert.equal(categoriaFinanceiraDoDesejo('vestuario'), 'compras');
  assert.equal(categoriaFinanceiraDoDesejo('casa'), 'moradia');
  assert.equal(categoriaFinanceiraDoDesejo('transporte'), 'transporte');
  assert.equal(categoriaFinanceiraDoDesejo('educacao'), 'educacao');
  assert.equal(categoriaFinanceiraDoDesejo('lazer'), 'lazer');
  assert.equal(categoriaFinanceiraDoDesejo('hobby'), 'lazer');
  assert.equal(categoriaFinanceiraDoDesejo('outros'), 'compras');
  assert.throws(() => categoriaFinanceiraDoDesejo('inexistente'), ErroValidacao);
});

test('descricao da transacao financeira da compra', () => {
  assert.equal(descricaoTransacaoCompra('SSD NVMe 1 TB'), 'Compra: SSD NVMe 1 TB');
});
