import { describe, it, expect } from 'vitest';
import { lerMesaPessoa, mesaValida } from '../lib/mesas.js';
import { itensEntregaveis, podeMudar, proximosEstados } from '../lib/estados.js';
import { totalConta, validarPedido } from '../lib/conta.js';

describe('mesas', () => {
  it('aceita qualquer número de 1 a 999 (mesas emprestadas do vizinho)', () => {
    expect(mesaValida(9)).toBe(true);
    expect(mesaValida(24)).toBe(true);
    expect(mesaValida(0)).toBe(false);
    expect(mesaValida(1000)).toBe(false);
    expect(mesaValida(2.5)).toBe(false);
    expect(mesaValida(null)).toBe(false);
  });

  it('lê o campo único "mesa/pessoa"', () => {
    expect(lerMesaPessoa('12/joao')).toEqual({ mesa: 12, pessoa: 'joao' });
    expect(lerMesaPessoa(' 14 / Carlos Silva ')).toEqual({ mesa: 14, pessoa: 'Carlos Silva' });
    expect(lerMesaPessoa('12')).toEqual({ mesa: 12, pessoa: null });
    expect(lerMesaPessoa('12/')).toEqual({ mesa: 12, pessoa: null });
  });

  it('recusa campo vazio, sem número ou fora do limite', () => {
    expect(lerMesaPessoa('').erro).toBeDefined();
    expect(lerMesaPessoa('joao').erro).toBeDefined();
    expect(lerMesaPessoa('/joao').erro).toBeDefined();
    expect(lerMesaPessoa('0/joao').erro).toBeDefined();
    expect(lerMesaPessoa('1000').erro).toBeDefined();
  });
});

describe('estados do item', () => {
  it('segue o fluxo novo -> em_preparo -> pronto -> entregue', () => {
    expect(podeMudar('novo', 'em_preparo')).toBe(true);
    expect(podeMudar('em_preparo', 'pronto')).toBe(true);
    expect(podeMudar('pronto', 'entregue')).toBe(true);
  });
  it('não volta nem pula a entrega', () => {
    expect(podeMudar('novo', 'entregue')).toBe(false);
    expect(podeMudar('pronto', 'novo')).toBe(false);
  });
  it('entregue e cancelado são finais', () => {
    expect(proximosEstados('entregue')).toEqual([]);
    expect(proximosEstados('cancelado')).toEqual([]);
  });
});

describe('conta', () => {
  it('soma os itens e ignora cancelados', () => {
    const itens = [
      { preco_centavos: 1200, quantidade: 2, estado: 'entregue' },
      { preco_centavos: 2800, quantidade: 1, estado: 'novo' },
      { preco_centavos: 1800, quantidade: 1, estado: 'cancelado' },
    ];
    expect(totalConta(itens)).toBe(5200);
  });
  it('valida o pedido', () => {
    expect(validarPedido(null, [{ quantidade: 1 }])).not.toBeNull();
    expect(validarPedido(12, [])).not.toBeNull();
    expect(validarPedido(12, [{ quantidade: 0 }])).not.toBeNull();
    expect(validarPedido(12, [{ quantidade: 2 }])).toBeNull();
  });
});

describe('entrega da mesa', () => {
  it('entrega o que está pronto e as bebidas do setor garçom, e mais nada', () => {
    const itens = [
      { id: 1, estado: 'pronto', setor: 'churrasqueira' },
      { id: 2, estado: 'pronto', setor: 'cozinha' },
      { id: 3, estado: 'novo', setor: 'garcom' },
      { id: 4, estado: 'novo', setor: 'churrasqueira' },
      { id: 5, estado: 'em_preparo', setor: 'cozinha' },
      { id: 6, estado: 'entregue', setor: 'cozinha' },
      { id: 7, estado: 'cancelado', setor: 'garcom' },
    ];
    expect(itensEntregaveis(itens).map((i) => i.id)).toEqual([1, 2, 3]);
  });
});
