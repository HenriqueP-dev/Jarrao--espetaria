import { describe, it, expect } from 'vitest';
import {
  validarProduto,
  categoriasDe,
  centavosParaCampo,
  descreverMudanca,
  filtrarProdutos,
} from '../lib/produtos.js';
import { formatarReais } from '../lib/conta.js';

const ok = { nome: 'Produto de teste', preco: '12,50', setor: 'garcom', categoria: 'Teste' };

describe('validarProduto', () => {
  it('aceita um produto certo e devolve o preço em centavos', () => {
    expect(validarProduto(ok)).toEqual({ ok: true, precoCentavos: 1250 });
    expect(validarProduto({ ...ok, preco: '12.5' }).precoCentavos).toBe(1250);
  });

  it('recusa nome vazio ou grande demais', () => {
    expect(validarProduto({ ...ok, nome: '   ' }).erro).toBeDefined();
    expect(validarProduto({ ...ok, nome: 'x'.repeat(81) }).erro).toBeDefined();
    expect(validarProduto({ ...ok, nome: 'x'.repeat(80) }).ok).toBe(true);
  });

  it('recusa preço zero, negativo, texto ou acima de R$ 5.000', () => {
    for (const preco of ['0', '', '-3', 'abc', '5000,01']) {
      expect(validarProduto({ ...ok, preco }).erro).toBeDefined();
    }
    expect(validarProduto({ ...ok, preco: '5000' }).precoCentavos).toBe(500000);
  });

  it('recusa setor desconhecido e categoria vazia', () => {
    expect(validarProduto({ ...ok, setor: 'bar' }).erro).toBeDefined();
    expect(validarProduto({ ...ok, setor: '' }).erro).toBeDefined();
    expect(validarProduto({ ...ok, categoria: ' ' }).erro).toBeDefined();
  });
});

describe('apoio da tela', () => {
  it('lista as categorias sem repetir, na ordem do cardápio', () => {
    const produtos = [{ categoria: 'Espetos' }, { categoria: 'Quibes' }, { categoria: 'Espetos' }, { categoria: null }];
    expect(categoriasDe(produtos)).toEqual(['Espetos', 'Quibes']);
  });

  it('mostra o preço no campo com vírgula', () => {
    expect(centavosParaCampo(1234)).toBe('12,34');
    expect(centavosParaCampo(500000)).toBe('5000,00');
  });

  it('filtra por busca, categoria e inativos', () => {
    const produtos = [
      { nome: 'Carne', categoria: 'Espetos da casa', ativo: true },
      { nome: 'Caipirinha de Limão', categoria: 'Drinks da casa', ativo: true },
      { nome: 'Espeto de carne', categoria: 'Teste antigo', ativo: false },
    ];
    expect(filtrarProdutos(produtos, { busca: 'limao' })).toHaveLength(1);
    expect(filtrarProdutos(produtos, { busca: 'CARNE' })).toHaveLength(2);
    expect(filtrarProdutos(produtos, { categoria: 'Drinks da casa' })).toHaveLength(1);
    expect(filtrarProdutos(produtos, { incluirInativos: false })).toHaveLength(2);
  });
});

describe('histórico do cardápio', () => {
  it('descreve cada tipo de mudança', () => {
    expect(descreverMudanca({ campo: 'criado', para: 'Pastel' })).toBe('Produto criado: Pastel');
    expect(descreverMudanca({ campo: 'preco_centavos', de: '1000', para: '1100' })).toBe(
      `Preço: ${formatarReais(1000)} → ${formatarReais(1100)}`
    );
    expect(descreverMudanca({ campo: 'setor', de: 'garcom', para: 'cozinha' })).toBe(
      'Setor: Garçom (sem preparo) → Cozinha'
    );
    expect(descreverMudanca({ campo: 'ativo', de: 'true', para: 'false' })).toBe('Produto desativado');
    expect(descreverMudanca({ campo: 'ativo', de: 'false', para: 'true' })).toBe('Produto reativado');
    expect(descreverMudanca({ campo: 'exige_espeto', de: 'false', para: 'true' })).toBe(
      'Exige escolher o espeto: não → sim'
    );
  });
});
