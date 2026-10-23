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

// Fichas (uma por mesa) que têm ao menos um item na aba/busca. A ficha mostra
// TODOS os itens ativos da mesa, não só os que casaram com o filtro: a mesa
// nunca é "fatiada" em vários cartões.
export function agruparFichas(itens, abaId, busca) {
  const contas = new Set(filtrarItens(itens, abaId, busca).map((i) => i.conta_id));
  return agruparPorConta(itens.filter((i) => contas.has(i.conta_id)));
}

// Em que fase está a ficha: tudo novo, tudo pronto, ou em andamento (misto).
export function faseDaFicha(itens) {
  if (itens.every((i) => i.estado === 'pronto')) return 'pronto';
  if (itens.every((i) => i.estado === 'novo')) return 'novo';
  return 'em_preparo';
}

// Itens que a ação da ficha inteira deve mudar para o estado de destino.
// O estado continua por item no banco; a ficha só aplica a mudança a todos.
export function itensParaAvancar(itens, destino) {
  const de = destino === 'em_preparo' ? ['novo'] : ['novo', 'em_preparo'];
  return itens.filter((i) => de.includes(i.estado));
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
