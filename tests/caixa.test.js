import { describe, it, expect } from 'vitest';
import {
  totalItens,
  saldo,
  parseReais,
  motivoNaoFechar,
  validarPagamento,
} from '../lib/caixa.js';

const itens = [
  { preco_centavos: 1200, quantidade: 2, estado: 'entregue' },
  { preco_centavos: 2800, quantidade: 1, estado: 'entregue' },
  { preco_centavos: 1800, quantidade: 1, estado: 'cancelado' },
];

describe('saldo da conta', () => {
  it('soma os itens não cancelados', () => {
    expect(totalItens(itens)).toBe(5200);
  });
  it('desconta os pagamentos', () => {
    expect(saldo(itens, [{ valor_centavos: 2000 }])).toBe(3200);
  });
});

describe('parseReais', () => {
  it('aceita vírgula e ponto', () => {
    expect(parseReais('52,50')).toBe(5250);
    expect(parseReais('52.5')).toBe(5250);
  });
  it('rejeita valores inválidos', () => {
    expect(parseReais('')).toBeNull();
    expect(parseReais('0')).toBeNull();
    expect(parseReais('abc')).toBeNull();
    expect(parseReais('-10')).toBeNull();
  });
});

describe('motivoNaoFechar', () => {
  it('bloqueia com item pendente', () => {
    const comPendente = [...itens, { preco_centavos: 600, quantidade: 1, estado: 'pronto' }];
    expect(motivoNaoFechar(comPendente, [{ valor_centavos: 99999 }])).toMatch(/não entregue/);
  });
  it('bloqueia se não estiver paga por completo', () => {
    expect(motivoNaoFechar(itens, [{ valor_centavos: 5000 }])).toMatch(/paga por completo/);
  });
  it('libera quando entregue e paga', () => {
    expect(motivoNaoFechar(itens, [{ valor_centavos: 5200 }])).toBeNull();
  });
});

describe('validarPagamento', () => {
  it('aceita pagamento até o saldo', () => {
    expect(validarPagamento(itens, [], 'dinheiro', 5200)).toBeNull();
    expect(validarPagamento(itens, [], 'debito', 1000)).toBeNull();
  });
  it('recusa valor acima do saldo (sem troco)', () => {
    expect(validarPagamento(itens, [], 'dinheiro', 5300)).toMatch(/troco/);
  });
  it('recusa forma desconhecida, como Pix por enquanto', () => {
    expect(validarPagamento(itens, [], 'pix', 100)).not.toBeNull();
  });
  it('recusa valor inválido', () => {
    expect(validarPagamento(itens, [], 'dinheiro', null)).not.toBeNull();
  });
});
