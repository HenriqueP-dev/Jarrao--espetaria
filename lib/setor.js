// Organização dos itens nas telas dos setores (cozinha e churrasqueira).
// Só lógica de exibição: não muda nenhuma regra de estado (ver lib/estados.js).
// HIPÓTESE (ver docs/DECISOES.md): faixas de tempo de espera dos tickets.

// Tira acentos e maiúsculas para a busca ("cafe" acha "Café").
export const normalizar = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Abas da tela do setor e os estados que cada uma mostra.
export const ABAS = [
  { id: 'todos', rotulo: 'Todos', estados: ['novo', 'em_preparo', 'pronto'] },
  { id: 'novo', rotulo: 'Novos', estados: ['novo'] },
  { id: 'em_preparo', rotulo: 'Preparo', estados: ['em_preparo'] },
  { id: 'pronto', rotulo: 'Prontos', estados: ['pronto'] },
];

// Quantas unidades existem em cada aba.
export function contarPorAba(itens) {
  const contagem = {};
  for (const aba of ABAS) {
    contagem[aba.id] = itens
      .filter((i) => aba.estados.includes(i.estado))
      .reduce((soma, i) => soma + i.quantidade, 0);
  }
  return contagem;
}

// Totais do que ainda falta fazer (novo + em preparo), por produto.
// Ex.: dois pedidos de "Batata frita" viram uma linha "Batata frita: 3".
export function resumoPorProduto(itens) {
  const total = new Map();
  for (const i of itens) {
    if (i.estado !== 'novo' && i.estado !== 'em_preparo') continue;
    total.set(i.nome_produto, (total.get(i.nome_produto) ?? 0) + i.quantidade);
  }
  return [...total.entries()]
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Minutos inteiros desde um instante (nunca negativo).
export function minutosDesde(iso, agora = Date.now()) {
  return Math.max(0, Math.floor((agora - Date.parse(iso)) / 60000));
}

// Faixa de urgência de um ticket pelo tempo do item mais antigo.
export function urgencia(minutos) {
  if (minutos >= 20) return 'critico';
  if (minutos >= 10) return 'atencao';
  return 'normal';
}

// Filtra por aba e busca (mesa, produto, pessoa ou observação).
export function filtrarItens(itens, abaId, busca) {
  const aba = ABAS.find((a) => a.id === abaId) ?? ABAS[0];
  const termo = normalizar(busca).trim();
  return itens.filter((i) => {
    if (!aba.estados.includes(i.estado)) return false;
    if (!termo) return true;
    const texto = normalizar(
      `mesa ${i.contas?.mesa_numero ?? ''} ${i.nome_produto} ${i.pessoa ?? ''} ${i.detalhe ?? ''}`
    );
    return texto.includes(termo);
  });
}

// Agrupa os itens por conta (um "ticket" por mesa), do mais antigo ao mais novo,
// para respeitar a ordem de chegada.
export function agruparPorConta(itens) {
  const grupos = new Map();
  for (const i of itens) {
    if (!grupos.has(i.conta_id)) {
      grupos.set(i.conta_id, {
        conta_id: i.conta_id,
        mesa: i.contas?.mesa_numero,
        itens: [],
        maisAntigo: i.criado_em,
      });
    }
    const g = grupos.get(i.conta_id);
    g.itens.push(i);
    if (Date.parse(i.criado_em) < Date.parse(g.maisAntigo)) g.maisAntigo = i.criado_em;
  }
  return [...grupos.values()].sort((a, b) => Date.parse(a.maisAntigo) - Date.parse(b.maisAntigo));
}
