import { describe, it, expect } from 'vitest';
import { mensagemDeErro } from '../lib/erros';

describe('mensagens de erro para a equipe', () => {
  it('mantém as regras do sistema, que já estão em português', () => {
    expect(mensagemDeErro({ code: 'P0001', message: 'Ainda há 2 item(ns) não entregue(s)' })).toBe('Ainda há 2 item(ns) não entregue(s)');
    expect(mensagemDeErro({ code: '42501', message: 'Entre no sistema para continuar' })).toBe('Entre no sistema para continuar');
  });

  it('troca erros técnicos por frases simples', () => {
    expect(mensagemDeErro({ code: '42501', message: 'permission denied for function criar_pedido' })).toMatch(/permissão/);
    expect(mensagemDeErro({ code: '23514', message: 'new row violates check constraint "itens_pedido_quantidade_maxima"' }))
      .not.toMatch(/itens_pedido/);
    expect(mensagemDeErro({ code: '23505', message: 'duplicate key value violates unique constraint "x"' })).toMatch(/igual/);
    expect(mensagemDeErro({ message: 'TypeError: Failed to fetch' })).toMatch(/conexão/);
    expect(mensagemDeErro({ code: 'PGRST301', message: 'JWT expired' })).toMatch(/sessão/);
    expect(mensagemDeErro({ code: 'XX000', message: 'internal error at foo.c' })).not.toMatch(/foo/);
  });

  it('sem erro, sem mensagem', () => {
    expect(mensagemDeErro(null)).toBeNull();
  });
});
