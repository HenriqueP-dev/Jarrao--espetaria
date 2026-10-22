import { describe, it, expect } from 'vitest';
import { MESAS, mesaValida } from '../lib/mesas.js';
import { podeMudar, proximosEstados } from '../lib/estados.js';
import { totalConta, validarPedido } from '../lib/conta.js';

describe('mesas', () => {
  it('tem 22 mesas e não tem a 9', () => {
    expect(MESAS).toHaveLength(22);
    expect(mesaValida(9)).toBe(false);
    expect(mesaValida(8)).toBe(true);
    expect(mesaValida(10)).toBe(true);
    expect(mesaValida(23)).toBe(true);
    expect(mesaValida(24)).toBe(false);
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
    expect(validarPedido(9, [{ quantidade: 1 }])).not.toBeNull();
    expect(validarPedido(12, [])).not.toBeNull();
    expect(validarPedido(12, [{ quantidade: 0 }])).not.toBeNull();
    expect(validarPedido(12, [{ quantidade: 2 }])).toBeNull();
  });
});
