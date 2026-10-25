import { describe, it, expect } from 'vitest';
import { separarCancelados, fichasPorColuna, faltaFazer } from '../lib/setor.js';

// Dados fictícios.
const item = (extra) => ({
  id: Math.random(),
  conta_id: 'c1',
  contas: { mesa_numero: 5 },
  nome_produto: 'Carne',
  quantidade: 1,
  estado: 'novo',
  pessoa: null,
  detalhe: null,
  criado_em: '2026-10-25T19:00:00Z',
  ...extra,
});

describe('cancelamento visível ao setor', () => {
  it('separa os cancelados dos itens ativos', () => {
    const itens = [
      item({ id: 1, estado: 'novo' }),
      item({ id: 2, estado: 'cancelado' }),
      item({ id: 3, estado: 'pronto' }),
    ];
    const { ativos, cancelados } = separarCancelados(itens);
    expect(ativos.map((i) => i.id)).toEqual([1, 3]);
    expect(cancelados.map((i) => i.id)).toEqual([2]);
  });

  it('cancelado não conta como falta fazer nem entra no quadro', () => {
    const itens = [
      item({ quantidade: 2, estado: 'novo' }),
      item({ quantidade: 5, estado: 'cancelado' }),
    ];
    const { ativos } = separarCancelados(itens);
    expect(faltaFazer(ativos)).toBe(2);
    const colunas = fichasPorColuna(ativos, '');
    expect(colunas.novo[0].itens).toHaveLength(1);
  });

  it('mesa só com itens cancelados não vira ficha para preparar', () => {
    const itens = [item({ estado: 'cancelado' })];
    const { ativos, cancelados } = separarCancelados(itens);
    const colunas = fichasPorColuna(ativos, '');
    expect(colunas.novo).toHaveLength(0);
    expect(colunas.em_preparo).toHaveLength(0);
    expect(colunas.pronto).toHaveLength(0);
    expect(cancelados).toHaveLength(1);
  });
});
