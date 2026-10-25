// Cadastro de produtos (tela /produtos, só o dono).
// As mesmas regras são conferidas de novo no banco (função salvar_produto, migration 010).

import { parseReais } from './caixa.js';
import { formatarReais } from './conta.js';

export const SETORES = {
  churrasqueira: 'Churrasqueira',
  cozinha: 'Cozinha',
  garcom: 'Garçom (sem preparo)',
};

export const PRECO_MAXIMO_CENTAVOS = 500000; // R$ 5.000,00

// Confere o formulário. Devolve { erro } ou { ok: true, precoCentavos }.
export function validarProduto({ nome, preco, setor, categoria }) {
  const n = String(nome ?? '').trim();
  const c = String(categoria ?? '').trim();
  if (n.length < 1 || n.length > 80) return { erro: 'O nome deve ter de 1 a 80 letras.' };
  const centavos = parseReais(preco);
  if (centavos === null) return { erro: 'Digite um preço maior que zero, como 12,50.' };
  if (centavos > PRECO_MAXIMO_CENTAVOS) return { erro: 'O preço deve ser no máximo R$ 5.000,00.' };
  if (!SETORES[setor]) return { erro: 'Escolha o setor do produto.' };
  if (c.length < 1 || c.length > 60) return { erro: 'A categoria deve ter de 1 a 60 letras.' };
  return { ok: true, precoCentavos: centavos };
}

// Categorias na ordem em que aparecem no cardápio (a lista já vem ordenada por "ordem").
export function categoriasDe(produtos) {
  return [...new Set(produtos.map((p) => p.categoria).filter(Boolean))];
}

// 1234 -> "12,34", para preencher o campo de edição.
export function centavosParaCampo(centavos) {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

const sim = (v) => (v === 'true' ? 'sim' : 'não');

// Uma linha do histórico do cardápio, em português simples.
export function descreverMudanca(h) {
  switch (h.campo) {
    case 'criado':
      return `Produto criado: ${h.para}`;
    case 'nome':
      return `Nome: ${h.de} → ${h.para}`;
    case 'preco_centavos':
      return `Preço: ${formatarReais(Number(h.de))} → ${formatarReais(Number(h.para))}`;
    case 'setor':
      return `Setor: ${SETORES[h.de] ?? h.de} → ${SETORES[h.para] ?? h.para}`;
    case 'categoria':
      return `Categoria: ${h.de} → ${h.para}`;
    case 'ativo':
      return h.para === 'true' ? 'Produto reativado' : 'Produto desativado';
    case 'exige_espeto':
      return `Exige escolher o espeto: ${sim(h.de)} → ${sim(h.para)}`;
    default:
      return `${h.campo}: ${h.de ?? '-'} → ${h.para ?? '-'}`;
  }
}

// Busca simples por nome ou categoria, sem diferenciar acentos nem maiúsculas.
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function filtrarProdutos(produtos, { busca = '', categoria = null, incluirInativos = true } = {}) {
  const termo = normalizar(busca).trim();
  return produtos.filter((p) => {
    if (!incluirInativos && !p.ativo) return false;
    if (categoria && p.categoria !== categoria) return false;
    if (!termo) return true;
    return normalizar(p.nome).includes(termo) || normalizar(p.categoria).includes(termo);
  });
}
