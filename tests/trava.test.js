import { describe, it, expect } from 'vitest';
import { criarTrava } from '../lib/trava';
import { novaChave, criarGuardaChave } from '../lib/chave';
import { erroDasLinhas, QUANTIDADE_MAXIMA, LINHAS_MAXIMAS } from '../lib/pedido';
import { validarPagamento, PAGAMENTO_MAXIMO_CENTAVOS } from '../lib/caixa';

describe('trava de ação (toque duplo)', () => {
  it('ignora a segunda chamada enquanto a primeira não terminou', async () => {
    const trava = criarTrava();
    let chamadas = 0;
    let liberar;
    const acao = () => {
      chamadas += 1;
      return new Promise((r) => (liberar = r));
    };
    const primeira = trava.executar(acao);
    const segunda = await trava.executar(acao); // ignorada, volta na hora
    expect(segunda).toBeUndefined();
    expect(chamadas).toBe(1);
    expect(trava.ocupado).toBe(true);
    liberar('ok');
    expect(await primeira).toBe('ok');
    expect(trava.ocupado).toBe(false);
  });

  it('libera a trava mesmo se a ação falhar e avisa as mudanças', async () => {
    const avisos = [];
    const trava = criarTrava((o) => avisos.push(o));
    await expect(trava.executar(async () => { throw new Error('falhou'); })).rejects.toThrow('falhou');
    expect(trava.ocupado).toBe(false);
    expect(await trava.executar(async () => 1)).toBe(1);
    expect(avisos).toEqual([true, false, true, false]);
  });
});

describe('chave de repetição segura', () => {
  it('gera UUIDs v4 diferentes', () => {
    const a = novaChave();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(novaChave()).not.toBe(a);
  });

  it('repete a chave no mesmo envio e troca depois de liberar ou se o conteúdo mudar', () => {
    let n = 0;
    const guarda = criarGuardaChave(() => `k${++n}`);
    expect(guarda.para('pedido A')).toBe('k1');
    expect(guarda.para('pedido A')).toBe('k1'); // nova tentativa: mesma chave
    expect(guarda.para('pedido B')).toBe('k2'); // conteúdo mudou
    guarda.liberar(); // deu certo
    expect(guarda.para('pedido B')).toBe('k3'); // novo pedido igual ao anterior: chave nova
  });
});

describe('tetos (iguais à migration 012)', () => {
  const produto = { id: 1, exige_espeto: false };
  it('recusa quantidade acima de 99 e linhas demais', () => {
    expect(erroDasLinhas([{ produto, quantidade: QUANTIDADE_MAXIMA, espeto: '' }])).toBeNull();
    expect(erroDasLinhas([{ produto, quantidade: QUANTIDADE_MAXIMA + 1, espeto: '' }])).toMatch(/limite/);
    const muitas = Array.from({ length: LINHAS_MAXIMAS + 1 }, () => ({ produto, quantidade: 1, espeto: '' }));
    expect(erroDasLinhas(muitas)).toMatch(/linhas demais/);
  });

  it('recusa pagamento acima de R$ 50.000,00', () => {
    const itens = [{ estado: 'entregue', preco_centavos: 100000000, quantidade: 1 }];
    expect(validarPagamento(itens, [], 'dinheiro', PAGAMENTO_MAXIMO_CENTAVOS)).toBeNull();
    expect(validarPagamento(itens, [], 'dinheiro', PAGAMENTO_MAXIMO_CENTAVOS + 1)).toMatch(/limite/);
  });
});
