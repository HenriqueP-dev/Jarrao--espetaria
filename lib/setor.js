// Organização dos itens nas telas dos setores (cozinha e churrasqueira).
// Só lógica de exibição: não muda nenhuma regra de estado (ver lib/estados.js).
// HIPÓTESE (ver docs/DECISOES.md): faixas de tempo de espera dos tickets.

// Tira acentos e maiúsculas para a busca ("cafe" acha "Café").
export const normalizar = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Colunas do quadro Kanban, da esquerda para a direita.
export const COLUNAS = [
  { id: 'novo', rotulo: 'Novos' },
  { id: 'em_preparo', rotulo: 'Em preparo' },
  { id: 'pronto', rotulo: 'Prontos' },
];

// Unidades que ainda faltam fazer (novo + em preparo).
export function faltaFazer(itens) {
  return itens
    .filter((i) => i.estado === 'novo' || i.estado === 'em_preparo')
    .reduce((soma, i) => soma + i.quantidade, 0);
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

// Filtra pela busca (mesa, produto, pessoa ou observação).
export function filtrarItens(itens, busca) {
  const termo = normalizar(busca).trim();
  if (!termo) return itens;
  return itens.filter((i) =>
    normalizar(
      `mesa ${i.contas?.mesa_numero ?? ''} ${i.nome_produto} ${i.pessoa ?? ''} ${i.detalhe ?? ''}`
    ).includes(termo)
  );
}

// Fichas (uma por mesa) que têm ao menos um item na busca. A ficha mostra
// TODOS os itens ativos da mesa, não só os que casaram: a mesa nunca é
// "fatiada" em vários cartões.
export function agruparFichas(itens, busca) {
  const contas = new Set(filtrarItens(itens, busca).map((i) => i.conta_id));
  return agruparPorConta(itens.filter((i) => contas.has(i.conta_id)));
}

// Em que fase está a ficha, pelo item MENOS adiantado: se ainda há item novo,
// a ficha está em "novo"; senão, se há item em preparo, "em_preparo"; senão "pronto".
export function faseDaFicha(itens) {
  if (itens.some((i) => i.estado === 'novo')) return 'novo';
  if (itens.some((i) => i.estado === 'em_preparo')) return 'em_preparo';
  return 'pronto';
}

// Distribui as fichas nas colunas do Kanban (cada mesa aparece em uma só coluna).
export function fichasPorColuna(itens, busca) {
  const colunas = { novo: [], em_preparo: [], pronto: [] };
  for (const ficha of agruparFichas(itens, busca)) {
    colunas[faseDaFicha(ficha.itens)].push(ficha);
  }
  return colunas;
}

// Itens que a ação da ficha inteira deve mudar para o estado de destino.
// O estado continua por item no banco; a ficha só aplica a mudança a todos.
export function itensParaAvancar(itens, destino) {
  const de = destino === 'em_preparo' ? ['novo'] : ['novo', 'em_preparo'];
  return itens.filter((i) => de.includes(i.estado));
}

// Agrupa os itens por conta (uma ficha por mesa), da mais antiga à mais nova,
// para respeitar a ordem de chegada. O tempo da ficha ("maisAntigo") conta a
// partir do item mais antigo que ainda não está pronto; se tudo está pronto,
// do mais antigo de todos.
export function agruparPorConta(itens) {
  const grupos = new Map();
  for (const i of itens) {
    if (!grupos.has(i.conta_id)) {
      grupos.set(i.conta_id, { conta_id: i.conta_id, mesa: i.contas?.mesa_numero, itens: [] });
    }
    grupos.get(i.conta_id).itens.push(i);
  }
  const maisAntigo = (lista) =>
    lista.reduce((a, i) => (Date.parse(i.criado_em) < Date.parse(a) ? i.criado_em : a), lista[0].criado_em);
  return [...grupos.values()]
    .map((g) => {
      const pendentes = g.itens.filter((i) => i.estado !== 'pronto');
      return { ...g, maisAntigo: maisAntigo(pendentes.length ? pendentes : g.itens) };
    })
    .sort((a, b) => Date.parse(a.maisAntigo) - Date.parse(b.maisAntigo));
}

// Grupos da tela Mesas, na ordem em que aparecem. O destino vem do cadastro
// do produto (campo setor): nada fixo por nome de produto.
export const GRUPOS = [
  { id: 'bebidas', rotulo: 'Bebidas', setor: 'garcom' },
  { id: 'espetos', rotulo: 'Espetos', setor: 'churrasqueira' },
  { id: 'cozinha', rotulo: 'Cozinha', setor: 'cozinha' },
];

// Separa os itens de uma mesa por grupo. Item de um setor desconhecido não
// some: vai para "Outros". Grupos sem itens são omitidos.
export function agruparPorSetor(itens) {
  const grupos = GRUPOS.map((g) => ({ ...g, itens: itens.filter((i) => i.setor === g.setor) }));
  const outros = itens.filter((i) => !GRUPOS.some((g) => g.setor === i.setor));
  if (outros.length) grupos.push({ id: 'outros', rotulo: 'Outros', setor: null, itens: outros });
  return grupos.filter((g) => g.itens.length);
}
