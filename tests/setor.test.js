import { describe, it, expect } from 'vitest';
import {
  agruparFichas,
  agruparPorConta,
  contarPorAba,
  faseDaFicha,
  filtrarItens,
  itensParaAvancar,
  minutosDesde,
  urgencia,
} from '../lib/setor';

// Dados fictícios.
const item = (extra) => ({
  id: Math.random(),
  conta_id: 'c1',
  contas: { mesa_numero: 5 },
  nome_produto: 'Espeto de carne',
  quantidade: 1,
  estado: 'novo',
  pessoa: null,
  detalhe: null,
  criado_em: '2026-10-22T19:00:00Z',
  ...extra,
});

describe('contarPorAba', () => {
  it('conta unidades, não linhas', () => {
    const itens = [
      item({ quantidade: 3 }),
      item({ estado: 'em_preparo', quantidade: 2 }),
      item({ estado: 'pronto' }),
    ];
    expect(contarPorAba(itens)).toEqual({ todos: 6, novo: 3, em_preparo: 2, pronto: 1 });
  });
});

describe('filtrarItens', () => {
  const itens = [
    item({ nome_produto: 'Espeto de frango', detalhe: 'bem passado' }),
    item({ nome_produto: 'Jantinha', contas: { mesa_numero: 12 }, estado: 'pronto' }),
  ];

  it('filtra por aba', () => {
    expect(filtrarItens(itens, 'pronto', '')).toHaveLength(1);
    expect(filtrarItens(itens, 'todos', '')).toHaveLength(2);
  });

  it('busca sem diferenciar acento e maiúscula, em produto, mesa e observação', () => {
    expect(filtrarItens(itens, 'todos', 'JANTINHA')).toHaveLength(1);
    expect(filtrarItens(itens, 'todos', 'mesa 12')).toHaveLength(1);
    expect(filtrarItens(itens, 'todos', 'bem pássado')).toHaveLength(1);
    expect(filtrarItens(itens, 'todos', 'picanha')).toHaveLength(0);
  });
});

describe('agruparPorConta', () => {
  it('junta os itens da mesma conta e ordena pelo mais antigo', () => {
    const itens = [
      item({ conta_id: 'b', contas: { mesa_numero: 2 }, criado_em: '2026-10-22T19:05:00Z' }),
      item({ conta_id: 'a', contas: { mesa_numero: 1 }, criado_em: '2026-10-22T19:10:00Z' }),
      item({ conta_id: 'b', contas: { mesa_numero: 2 }, criado_em: '2026-10-22T18:50:00Z' }),
    ];
    const grupos = agruparPorConta(itens);
    expect(grupos.map((g) => g.mesa)).toEqual([2, 1]);
    expect(grupos[0].itens).toHaveLength(2);
    expect(grupos[0].maisAntigo).toBe('2026-10-22T18:50:00Z');
  });
});

describe('ficha única por mesa', () => {
  const itens = [
    item({ conta_id: 'a', contas: { mesa_numero: 1 }, nome_produto: 'Jantinha', estado: 'novo' }),
    item({ conta_id: 'a', contas: { mesa_numero: 1 }, nome_produto: 'Espeto', estado: 'pronto' }),
    item({ conta_id: 'b', contas: { mesa_numero: 2 }, nome_produto: 'Espeto', estado: 'em_preparo' }),
  ];

  it('mostra todos os itens da mesa mesmo quando só um casa com a aba', () => {
    const fichas = agruparFichas(itens, 'novo', '');
    expect(fichas).toHaveLength(1);
    expect(fichas[0].itens).toHaveLength(2);
  });

  it('a busca acha a mesa e mantém a ficha inteira', () => {
    const fichas = agruparFichas(itens, 'todos', 'jantinha');
    expect(fichas.map((f) => f.mesa)).toEqual([1]);
    expect(fichas[0].itens).toHaveLength(2);
  });

  it('descobre a fase da ficha', () => {
    expect(faseDaFicha([item({}), item({})])).toBe('novo');
    expect(faseDaFicha([item({ estado: 'pronto' })])).toBe('pronto');
    expect(faseDaFicha([item({}), item({ estado: 'pronto' })])).toBe('em_preparo');
  });

  it('a ação da ficha só muda os itens que ainda podem mudar', () => {
    const lista = [
      item({ id: 1, estado: 'novo' }),
      item({ id: 2, estado: 'em_preparo' }),
      item({ id: 3, estado: 'pronto' }),
    ];
    expect(itensParaAvancar(lista, 'em_preparo').map((i) => i.id)).toEqual([1]);
    expect(itensParaAvancar(lista, 'pronto').map((i) => i.id)).toEqual([1, 2]);
  });
});

describe('tempo de espera', () => {
  it('calcula minutos inteiros e nunca negativos', () => {
    const agora = Date.parse('2026-10-22T19:10:30Z');
    expect(minutosDesde('2026-10-22T19:00:00Z', agora)).toBe(10);
    expect(minutosDesde('2026-10-22T19:20:00Z', agora)).toBe(0);
  });

  it('classifica a urgência', () => {
    expect(urgencia(9)).toBe('normal');
    expect(urgencia(10)).toBe('atencao');
    expect(urgencia(20)).toBe('critico');
  });
});
