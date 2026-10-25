// Transforma uma cópia de segurança (.json baixado em /equipe) em um arquivo SQL que devolve
// os dados a um banco com as migrations já aplicadas. Uso: scripts/gerar-restauracao.mjs e
// docs/BACKUP.md. Nada aqui fala com o banco: só monta o texto do SQL.

// Ordem de inserção: quem é apontado vem antes de quem aponta (chaves estrangeiras).
// `perfis` fica de fora: depende das contas de login (auth.users), que não vão na cópia.
export const ORDEM_DE_RESTAURACAO = [
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

// Tabelas com número automático (id): depois de inserir, o contador continua do maior id.
const COM_ID_AUTOMATICO = new Set(ORDEM_DE_RESTAURACAO.filter((t) => t !== 'mesas'));

const MARCA = '$copia_jarrao$';

export function gerarSqlDeRestauracao(copia, { esquema = 'public' } = {}) {
  if (!copia || copia.sistema !== 'Jarrão Espetaria' || !copia.tabelas) {
    throw new Error('Este arquivo não é uma cópia de segurança do Jarrão.');
  }
  if (!/^[a-z_][a-z0-9_]*$/.test(esquema)) throw new Error('Nome de esquema inválido.');

  const linhas = [
    `-- Restauração da cópia de ${copia.gerada_em}`,
    '-- Rode no SQL Editor de um banco com as migrations aplicadas. Tudo ou nada.',
    'begin;',
    // desliga os gatilhos só nesta transação: a baixa de estoque e o autor do histórico já
    // estão gravados na cópia e não podem ser lançados de novo
    'set local session_replication_role = replica;',
  ];
  for (const tabela of ORDEM_DE_RESTAURACAO) {
    const dados = copia.tabelas[tabela] ?? [];
    if (!dados.length) continue;
    const json = JSON.stringify(dados);
    if (json.includes(MARCA)) throw new Error(`A tabela ${tabela} tem um texto que impede a restauração automática.`);
    const alvo = `${esquema}.${tabela}`;
    linhas.push(
      `-- ${tabela}: ${dados.length} linha(s)`,
      `insert into ${alvo}${COM_ID_AUTOMATICO.has(tabela) ? ' overriding system value' : ''}`,
      `select * from jsonb_populate_recordset(null::${alvo}, ${MARCA}${json}${MARCA}::jsonb)`,
      'on conflict do nothing;'
    );
    if (COM_ID_AUTOMATICO.has(tabela)) {
      linhas.push(
        `select setval(pg_get_serial_sequence('${alvo}', 'id'), greatest((select max(id) from ${alvo}), 1));`
      );
    }
  }
  linhas.push('commit;', '');
  return linhas.join('\n');
}
