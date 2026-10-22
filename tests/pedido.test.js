import { describe, it, expect } from 'vitest';
import { adicionarProduto, detalheDaLinha, erroDasLinhas, itensParaEnvio } from '../lib/pedido.js';
import { podeMudar, proximosEstados } from '../lib/estados.js';

const carne = { id: 1, nome: 'Carne', preco_centavos: 1000, exige_espeto: false };
const jantinha = { id: 2, nome: 'Jantinha Simples', preco_centavos: 2500, exige_espeto: true };

describe('rascunho do pedido', () => {
  it('soma a quantidade de produtos iguais sem observação', () => {
    let linhas = adicionarProduto([], carne, 1);
    linhas = adicionarProduto(linhas, carne, 2);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].quantidade).toBe(2);
  });

  it('não soma se a linha já tem observação', () => {
    let linhas = adicionarProduto([], carne, 1);
    linhas = [{ ...linhas[0], obs: 'bem passado' }];
    linhas = adicionarProduto(linhas, carne, 2);
    expect(linhas).toHaveLength(2);
  });

  it('cada jantinha ganha sua própria linha', () => {
    let linhas = adicionarProduto([], jantinha, 1);
    linhas = adicionarProduto(linhas, jantinha, 2);
    expect(linhas).toHaveLength(2);
  });

  it('exige o espeto na jantinha', () => {
    const linhas = adicionarProduto([], jantinha, 1);
    expect(erroDasLinhas(linhas)).not.toBeNull();
    expect(erroDasLinhas([{ ...linhas[0], espeto: 'Carne' }])).toBeNull();
  });

  it('monta o texto para os setores', () => {
    expect(detalheDaLinha({ espeto: 'Carne', obs: ' sem vinagrete ' })).toBe(
      'Espeto: Carne · sem vinagrete'
    );
    expect(detalheDaLinha({ espeto: '', obs: '' })).toBe('');
  });

  it('prepara os itens no formato do banco', () => {
    const linhas = [{ ...adicionarProduto([], carne, 1)[0], quantidade: 2 }];
    expect(itensParaEnvio(linhas, ' João ')).toEqual([
      { produto_id: 1, quantidade: 2, pessoa: 'João', detalhe: null },
    ]);
    expect(itensParaEnvio(linhas, '')[0].pessoa).toBeNull();
  });
});

describe('itens do setor garçom (bebidas)', () => {
  it('vão de Novo direto para Entregue', () => {
    expect(podeMudar('novo', 'entregue', 'garcom')).toBe(true);
    expect(podeMudar('novo', 'em_preparo', 'garcom')).toBe(false);
    expect(podeMudar('novo', 'pronto', 'garcom')).toBe(false);
    expect(proximosEstados('novo', 'garcom')).toContain('cancelado');
  });

  it('itens de preparo continuam passando por Pronto antes de Entregue', () => {
    expect(podeMudar('novo', 'entregue', 'churrasqueira')).toBe(false);
    expect(podeMudar('pronto', 'entregue', 'cozinha')).toBe(true);
  });
});
