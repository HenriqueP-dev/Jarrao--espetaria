import { describe, it, expect } from 'vitest';
import {
  agruparFichas,
  agruparPorSetor,
  agruparPorConta,
  faltaFazer,
  faseDaFicha,
  fichasPorColuna,
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

describe('faltaFazer', () => {
  it('conta unidades (não linhas) de novo e em preparo, sem os prontos', () => {
    const itens = [
      item({ quantidade: 3 }),
      item({ estado: 'em_preparo', quantidade: 2 }),
      item({ estado: 'pronto', quantidade: 9 }),
    ];
    expect(faltaFazer(itens)).toBe(5);
  });
});

describe('filtrarItens', () => {
  const itens = [
    item({ nome_produto: 'Espeto de frango', detalhe: 'bem passado' }),
    item({ nome_produto: 'Jantinha', contas: { mesa_numero: 12 }, estado: 'pronto' }),
  ];

  it('sem busca devolve tudo', () => {
    expect(filtrarItens(itens, '')).toHaveLength(2);
  });

  it('busca sem diferenciar acento e maiúscula, em produto, mesa e observação', () => {
    expect(filtrarItens(itens, 'JANTINHA')).toHaveLength(1);
    expect(filtrarItens(itens, 'mesa 12')).toHaveLength(1);
    expect(filtrarItens(itens, 'bem pássado')).toHaveLength(1);
    expect(filtrarItens(itens, 'picanha')).toHaveLength(0);
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

  it('o tempo da ficha ignora itens já prontos quando ainda há o que fazer', () => {
    const grupos = agruparPorConta([
      item({ estado: 'pronto', criado_em: '2026-10-22T18:00:00Z' }),
      item({ estado: 'novo', criado_em: '2026-10-22T19:00:00Z' }),
    ]);
    expect(grupos[0].maisAntigo).toBe('2026-10-22T19:00:00Z');
  });
});

describe('ficha única por mesa e Kanban', () => {
  const itens = [
    item({ conta_id: 'a', contas: { mesa_numero: 1 }, nome_produto: 'Jantinha', estado: 'novo' }),
    item({ conta_id: 'a', contas: { mesa_numero: 1 }, nome_produto: 'Espeto', estado: 'pronto' }),
    item({ conta_id: 'b', contas: { mesa_numero: 2 }, nome_produto: 'Espeto', estado: 'em_preparo' }),
    item({ conta_id: 'c', contas: { mesa_numero: 3 }, nome_produto: 'Batata', estado: 'pronto' }),
  ];

  it('a ficha mostra todos os itens da mesa, mesmo achando só um na busca', () => {
    const fichas = agruparFichas(itens, 'jantinha');
    expect(fichas.map((f) => f.mesa)).toEqual([1]);
    expect(fichas[0].itens).toHaveLength(2);
  });

  it('descobre a fase pelo item menos adiantado', () => {
    expect(faseDaFicha([item({}), item({ estado: 'pronto' })])).toBe('novo');
    expect(faseDaFicha([item({ estado: 'em_preparo' }), item({ estado: 'pronto' })])).toBe('em_preparo');
    expect(faseDaFicha([item({ estado: 'pronto' })])).toBe('pronto');
  });

  it('cada mesa cai em uma única coluna', () => {
    const col = fichasPorColuna(itens, '');
    expect(col.novo.map((f) => f.mesa)).toEqual([1]);
    expect(col.em_preparo.map((f) => f.mesa)).toEqual([2]);
    expect(col.pronto.map((f) => f.mesa)).toEqual([3]);
  });

  it('a busca esvazia as colunas que não casam', () => {
    const col = fichasPorColuna(itens, 'batata');
    expect(col.novo).toHaveLength(0);
    expect(col.pronto.map((f) => f.mesa)).toEqual([3]);
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

describe('grupos da tela Mesas', () => {
  const itens = [
    item({ id: 1, setor: 'garcom', estado: 'novo' }),
    item({ id: 2, setor: 'churrasqueira', estado: 'pronto' }),
    item({ id: 3, setor: 'cozinha', estado: 'em_preparo' }),
    item({ id: 4, setor: 'churrasqueira', estado: 'novo' }),
    item({ id: 5, setor: 'novo_setor', estado: 'novo' }),
  ];

  it('separa em bebidas, espetos e cozinha, mantendo a ordem e sem perder itens', () => {
    const g = agruparPorSetor(itens);
    expect(g.map((x) => x.id)).toEqual(['bebidas', 'espetos', 'cozinha', 'outros']);
    expect(g.find((x) => x.id === 'espetos').itens.map((i) => i.id)).toEqual([2, 4]);
    expect(g.flatMap((x) => x.itens)).toHaveLength(itens.length);
  });

  it('omite grupos vazios', () => {
    expect(agruparPorSetor([item({ setor: 'cozinha' })]).map((x) => x.id)).toEqual(['cozinha']);
  });
});
