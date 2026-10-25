import { describe, it, expect } from 'vitest';
import {
  statusDoSaldo,
  ordenarPorUrgencia,
  lerQuantidade,
  lerContagem,
  unidadesDaEntrada,
  descreverMovimento,
  filtrarLinhas,
} from '../lib/estoque.js';

describe('status do saldo', () => {
  it('negativo, baixo e ok', () => {
    expect(statusDoSaldo(-3, 10)).toBe('negativo');
    expect(statusDoSaldo(0, 0)).toBe('baixo');
    expect(statusDoSaldo(10, 10)).toBe('baixo');
    expect(statusDoSaldo(11, 10)).toBe('ok');
    expect(statusDoSaldo(5, 0)).toBe('ok'); // sem mínimo definido, só avisa quando zera
  });

  it('ordena do mais urgente para o mais tranquilo, depois por nome', () => {
    const linhas = [
      { nome: 'Zebra', saldo: 50, estoque_minimo: 10 },
      { nome: 'Água', saldo: 50, estoque_minimo: 10 },
      { nome: 'Skol', saldo: 8, estoque_minimo: 10 },
      { nome: 'Coca', saldo: -2, estoque_minimo: 10 },
    ];
    expect(ordenarPorUrgencia(linhas).map((l) => l.nome)).toEqual(['Coca', 'Skol', 'Água', 'Zebra']);
  });
});

describe('números digitados', () => {
  it('quantidade é inteiro de 1 a 100000', () => {
    expect(lerQuantidade('3')).toBe(3);
    expect(lerQuantidade(' 45 ')).toBe(45);
    for (const ruim of ['', '0', '-1', '2,5', '1.5', 'abc', '100001']) {
      expect(lerQuantidade(ruim)).toBeNull();
    }
  });

  it('contagem aceita zero', () => {
    expect(lerContagem('0')).toBe(0);
    expect(lerContagem('40')).toBe(40);
    expect(lerContagem('-1')).toBeNull();
    expect(lerContagem('1000001')).toBeNull();
  });

  it('converte embalagem em unidades', () => {
    expect(unidadesDaEntrada(3, { unidades: 15 })).toBe(45);
    expect(unidadesDaEntrada(5, null)).toBe(5);
  });
});

describe('apresentação', () => {
  it('descreve os movimentos', () => {
    expect(descreverMovimento({ tipo: 'entrada', quantidade: 45, detalhe: '3 caixa de 15' })).toBe(
      'Entrada: +45 un. (3 caixa de 15)'
    );
    expect(descreverMovimento({ tipo: 'venda', quantidade: -2, detalhe: null })).toBe('Venda: −2 un.');
    expect(descreverMovimento({ tipo: 'ajuste', quantidade: -7, detalhe: 'Contagem' })).toContain('−7');
  });

  it('filtra por busca e só alertas', () => {
    const linhas = [
      { nome: 'Skol 600ml', categoria: 'Cervejas 600 ml', saldo: 40, estoque_minimo: 10 },
      { nome: 'Carne', categoria: 'Espetos da casa', saldo: 3, estoque_minimo: 5 },
    ];
    expect(filtrarLinhas(linhas, { busca: 'cervejas' })).toHaveLength(1);
    expect(filtrarLinhas(linhas, { soAlertas: true }).map((l) => l.nome)).toEqual(['Carne']);
  });
});
