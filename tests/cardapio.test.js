import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Confere a lista de produtos da migration 004 (sem precisar do banco).
const sql = readFileSync(new URL('../supabase/migrations/004_cardapio_real.sql', import.meta.url), 'utf8');
const padrao = /^ {2}\('((?:[^']|'')+)', (\d+), '(\w+)', '((?:[^']|'')+)', (\d+), (true|false)\)/gm;
const produtos = [...sql.matchAll(padrao)].map((m) => ({
  nome: m[1].replaceAll("''", "'"),
  centavos: Number(m[2]),
  setor: m[3],
  categoria: m[4],
  ordem: Number(m[5]),
  exigeEspeto: m[6] === 'true',
}));

describe('cardápio real (migration 004)', () => {
  it('cadastra todos os produtos da lista', () => {
    expect(produtos).toHaveLength(133);
  });

  it('não tem preço zero ou negativo', () => {
    expect(produtos.filter((p) => p.centavos <= 0)).toEqual([]);
  });

  it('não repete nome de produto', () => {
    const nomes = produtos.map((p) => p.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it('usa só setores conhecidos', () => {
    const setores = new Set(produtos.map((p) => p.setor));
    expect([...setores].sort()).toEqual(['churrasqueira', 'cozinha', 'garcom']);
  });

  it('bebidas prontas vão para o garçom e espetos para a churrasqueira', () => {
    const setorDe = (nome) => produtos.find((p) => p.nome === nome)?.setor;
    expect(setorDe('Skol 600ml')).toBe('garcom');
    expect(setorDe('Carne')).toBe('churrasqueira');
    expect(setorDe('Quibe Carne')).toBe('cozinha');
    expect(setorDe('Jantinha Completa')).toBe('churrasqueira');
  });

  it('só as jantinhas exigem escolha de espeto', () => {
    const exigem = produtos.filter((p) => p.exigeEspeto).map((p) => p.nome);
    expect(exigem).toEqual(['Jantinha Simples', 'Jantinha Completa']);
  });

  it('guarda os preços informados', () => {
    const preco = (nome) => produtos.find((p) => p.nome === nome)?.centavos;
    expect(preco('Jantinha Simples')).toBe(2500);
    expect(preco('Batata Simples (inteira)')).toBe(5500);
    expect(preco('Caipirinha de Limão')).toBe(2500);
  });

  it('não inclui itens sem preço confirmado', () => {
    const texto = produtos.map((p) => p.nome.toLowerCase()).join('|');
    for (const proibido of ['rúcula, tomate', 'torresmo', 'frios', '51 ice', 'eisenbahn', 'helles']) {
      expect(texto).not.toContain(proibido);
    }
    expect(produtos.find((p) => p.nome === 'Amendoim (meia)')).toBeUndefined();
  });
});
