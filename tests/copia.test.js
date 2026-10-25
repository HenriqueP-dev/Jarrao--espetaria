import { describe, it, expect } from 'vitest';
import { lerTudo, montarCopia, nomeDoArquivo, chaveDaTabela, LOTE, TABELAS_DA_COPIA } from '../lib/copia';

describe('cópia de segurança', () => {
  it('lê a tabela inteira em lotes de 1000', async () => {
    const total = LOTE * 2 + 5;
    const pedidos = [];
    const linhas = await lerTudo(async (de, ate) => {
      pedidos.push([de, ate]);
      const fim = Math.min(ate, total - 1);
      return { data: Array.from({ length: Math.max(0, fim - de + 1) }, (_, i) => ({ id: de + i })), error: null };
    });
    expect(linhas).toHaveLength(total);
    expect(pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('para no primeiro erro (não gera cópia pela metade)', async () => {
    await expect(lerTudo(async () => ({ data: null, error: new Error('sem permissão') }))).rejects.toThrow('sem permissão');
  });

  it('monta o arquivo com contagem por tabela', () => {
    const copia = montarCopia({ contas: [{ id: 1 }, { id: 2 }], pagamentos: [] }, new Date('2026-10-25T23:30:00Z'));
    expect(copia.contagem).toEqual({ contas: 2, pagamentos: 0 });
    expect(copia.gerada_em).toBe('2026-10-25T23:30:00.000Z');
  });

  it('nomeia o arquivo no horário de Brasília', () => {
    expect(nomeDoArquivo(new Date('2026-10-25T23:30:00Z'))).toBe('jarrao-copia-2026-10-25-2030.json');
  });

  it('ordena cada tabela pela chave dela', () => {
    expect(chaveDaTabela('perfis')).toBe('user_id');
    expect(chaveDaTabela('mesas')).toBe('numero');
    expect(chaveDaTabela('contas')).toBe('id');
  });

  it('inclui as tabelas de dinheiro e histórico', () => {
    for (const t of ['contas', 'itens_pedido', 'pagamentos', 'historico', 'estoque_movimentos']) {
      expect(TABELAS_DA_COPIA).toContain(t);
    }
  });
});
