import { describe, it, expect } from 'vitest';
import { gerarSqlDeRestauracao, ORDEM_DE_RESTAURACAO } from '../lib/restauracao';

const copia = {
  sistema: 'Jarrão Espetaria',
  gerada_em: '2026-10-25T23:30:00.000Z',
  tabelas: {
    perfis: [{ user_id: 'x', nome: 'Dono', perfil: 'dono', ativo: true }],
    mesas: [{ numero: 5 }],
    contas: [{ id: 7, mesa_numero: 5, status: 'aberta' }],
    historico: [{ id: 3, conta_id: 7, evento: 'conta_aberta', detalhe: "O'Brien" }],
    pagamentos: [],
  },
};

describe('restauração da cópia', () => {
  it('insere na ordem das chaves estrangeiras e pula tabelas vazias e perfis', () => {
    const sql = gerarSqlDeRestauracao(copia);
    const pos = (t) => sql.indexOf(`insert into public.${t}`);
    expect(pos('mesas')).toBeGreaterThan(-1);
    expect(pos('mesas')).toBeLessThan(pos('contas'));
    expect(pos('contas')).toBeLessThan(pos('historico'));
    expect(pos('pagamentos')).toBe(-1);
    expect(pos('perfis')).toBe(-1);
    expect(ORDEM_DE_RESTAURACAO).not.toContain('perfis');
  });

  it('é tudo ou nada, sem gatilhos, e acerta os contadores de id', () => {
    const sql = gerarSqlDeRestauracao(copia);
    expect(sql.startsWith('-- Restauração')).toBe(true);
    expect(sql).toContain('begin;');
    expect(sql).toContain('set local session_replication_role = replica;');
    expect(sql.trim().endsWith('commit;')).toBe(true);
    expect(sql).toContain("insert into public.contas overriding system value");
    expect(sql).toContain("setval(pg_get_serial_sequence('public.contas', 'id')");
    expect(sql).not.toContain("pg_get_serial_sequence('public.mesas'"); // mesas não tem id automático
  });

  it('textos com aspas passam intactos (vão dentro de $copia_jarrao$)', () => {
    expect(gerarSqlDeRestauracao(copia)).toContain(`"detalhe":"O'Brien"`);
  });

  it('recusa arquivo que não é cópia do Jarrão e esquema inválido', () => {
    expect(() => gerarSqlDeRestauracao({ foo: 1 })).toThrow(/não é uma cópia/);
    expect(() => gerarSqlDeRestauracao(copia, { esquema: 'public; drop table x' })).toThrow(/inválido/);
  });
});
