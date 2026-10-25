// Gera o SQL de restauração a partir de uma cópia baixada em /equipe.
// Uso:  node scripts/gerar-restauracao.mjs jarrao-copia-AAAA-MM-DD-HHMM.json
// Cria, ao lado, um arquivo .sql para colar no SQL Editor do Supabase (ver docs/BACKUP.md).
import { readFileSync, writeFileSync } from 'node:fs';
import { gerarSqlDeRestauracao } from '../lib/restauracao.js';

const entrada = process.argv[2];
if (!entrada) {
  console.error('Informe o arquivo da cópia. Ex.: node scripts/gerar-restauracao.mjs jarrao-copia.json');
  process.exit(1);
}
const copia = JSON.parse(readFileSync(entrada, 'utf8'));
const saida = entrada.replace(/\.json$/i, '') + '-restaurar.sql';
writeFileSync(saida, gerarSqlDeRestauracao(copia));
console.log(`Pronto: ${saida}`);
console.log('Linhas por tabela na cópia:', copia.contagem);
