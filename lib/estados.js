// Estados de um item e transições permitidas.
// HIPÓTESE (ver docs/DECISOES.md): estado controlado por item.
// Mantenha igual à função mudar_estado_item no SQL (migration 004).

export const ESTADOS = ['novo', 'em_preparo', 'pronto', 'entregue', 'cancelado'];

export const ROTULOS = {
  novo: 'Novo',
  em_preparo: 'Em preparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

// Itens do setor "garçom" (bebidas) não passam por preparo:
// o próprio garçom anota e busca, então vão de Novo direto para Entregue.
export const SETOR_GARCOM = 'garcom';

const TRANSICOES = {
  novo: ['em_preparo', 'pronto', 'cancelado'],
  em_preparo: ['pronto', 'cancelado'],
  pronto: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: [],
};

export function proximosEstados(estado, setor) {
  if (setor === SETOR_GARCOM && estado === 'novo') return ['entregue', 'cancelado'];
  return TRANSICOES[estado] ?? [];
}

export function podeMudar(de, para, setor) {
  return proximosEstados(de, setor).includes(para);
}
