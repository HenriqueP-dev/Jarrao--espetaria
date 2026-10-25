// Estoque (tela /estoque). As regras de verdade ficam no banco (migration 011);
// aqui só a leitura dos números digitados e a apresentação.
// HIPÓTESE (ver docs/DECISOES.md, seção E): o estoque nunca bloqueia uma venda.

export const TIPOS = {
  entrada: 'Entrada',
  venda: 'Venda',
  estorno: 'Devolvido (cancelado antes do preparo)',
  perda: 'Perda',
  consumo_interno: 'Consumo interno',
  ajuste: 'Ajuste da contagem',
};

export const ROTULO_STATUS = {
  negativo: 'Negativo',
  baixo: 'Acabando',
  ok: 'Ok',
};

// negativo: vendeu mais do que o sistema sabia que tinha. baixo: chegou no mínimo (ou zerou).
export function statusDoSaldo(saldo, minimo) {
  if (saldo < 0) return 'negativo';
  if (saldo === 0 || (minimo > 0 && saldo <= minimo)) return 'baixo';
  return 'ok';
}

const PESO = { negativo: 0, baixo: 1, ok: 2 };

// Primeiro o que precisa de atenção; depois por nome.
export function ordenarPorUrgencia(linhas) {
  return [...linhas].sort((a, b) => {
    const d = PESO[statusDoSaldo(a.saldo, a.estoque_minimo)] - PESO[statusDoSaldo(b.saldo, b.estoque_minimo)];
    return d || a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

// Inteiro de 1 a 100000, ou null.
export function lerQuantidade(texto) {
  const t = String(texto ?? '').trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= 100000 ? n : null;
}

// Inteiro de 0 a 1000000, ou null (contagem pode ser zero).
export function lerContagem(texto) {
  const t = String(texto ?? '').trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= 1000000 ? n : null;
}

// Quantas unidades entram: 3 caixas de 15 = 45; sem embalagem, a própria quantidade.
export function unidadesDaEntrada(quantidade, embalagem) {
  return quantidade * (embalagem ? embalagem.unidades : 1);
}

// Uma linha do histórico de movimentos.
export function descreverMovimento(m) {
  const sinal = m.quantidade > 0 ? '+' : '−';
  const base = `${TIPOS[m.tipo] ?? m.tipo}: ${sinal}${Math.abs(m.quantidade)} un.`;
  return m.detalhe ? `${base} (${m.detalhe})` : base;
}

// Busca simples por nome ou categoria, sem diferenciar acentos nem maiúsculas.
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function filtrarLinhas(linhas, { busca = '', soAlertas = false } = {}) {
  const termo = normalizar(busca).trim();
  return linhas.filter((l) => {
    if (soAlertas && statusDoSaldo(l.saldo, l.estoque_minimo) === 'ok') return false;
    if (!termo) return true;
    return normalizar(l.nome).includes(termo) || normalizar(l.categoria).includes(termo);
  });
}
