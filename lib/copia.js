// Cópia de segurança que o dono baixa pelo navegador (tela /equipe; auditoria, etapa 7).
// É um arquivo JSON com todas as tabelas do sistema, lidas com o login do dono (as regras do
// banco continuam valendo). Não inclui senhas: as contas de login ficam no Supabase Auth.
// Como restaurar: docs/BACKUP.md.

export const TABELAS_DA_COPIA = [
  'configuracao',
  'perfis',
  'mesas',
  'produtos',
  'produto_embalagens',
  'contas',
  'pedidos',
  'itens_pedido',
  'pagamentos',
  'historico',
  'estoque_movimentos',
  'produtos_historico',
];

// Coluna para ordenar (sem ordem fixa, a leitura em lotes poderia pular ou repetir linhas).
export function chaveDaTabela(tabela) {
  if (tabela === 'perfis') return 'user_id';
  if (tabela === 'mesas') return 'numero';
  return 'id';
}

export const LOTE = 1000; // a API do Supabase devolve no máximo 1000 linhas por consulta

// Lê uma tabela inteira em lotes. `buscar(de, ate)` devolve { data, error } (supabase .range()).
export async function lerTudo(buscar) {
  const linhas = [];
  for (let de = 0; ; de += LOTE) {
    const { data, error } = await buscar(de, de + LOTE - 1);
    if (error) throw error;
    linhas.push(...data);
    if (data.length < LOTE) return linhas;
  }
}

export function montarCopia(tabelas, agora = new Date()) {
  return {
    sistema: 'Jarrão Espetaria',
    versao_da_copia: 1,
    gerada_em: agora.toISOString(),
    contagem: Object.fromEntries(Object.entries(tabelas).map(([t, linhas]) => [t, linhas.length])),
    tabelas,
  };
}

// "jarrao-copia-2026-10-25-2130.json", no horário de Brasília
export function nomeDoArquivo(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(agora);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `jarrao-copia-${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}.json`;
}
