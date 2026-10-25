import { describe, it, expect } from 'vitest';
import {
  hojeISO,
  somarDias,
  diasEntre,
  intervalo,
  diaCurto,
  serieDoGrafico,
  escalaY,
  compactarReais,
  participacao,
  ticketMedio,
} from '../lib/relatorio.js';

// Dados fictícios. 25/10/2026 é domingo; 12:00 UTC = 09:00 em Brasília.
const agora = new Date('2026-10-25T12:00:00Z');

describe('datas e períodos', () => {
  it('usa o dia de Brasília, não o de Greenwich', () => {
    // 01:00 UTC do dia 26 ainda é noite do dia 25 em Brasília (UTC-3)
    expect(hojeISO(new Date('2026-10-26T01:00:00Z'))).toBe('2026-10-25');
    expect(hojeISO(new Date('2026-10-26T03:30:00Z'))).toBe('2026-10-26');
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('conta os dias do intervalo, inclusive os dois extremos', () => {
    expect(diasEntre('2026-10-25', '2026-10-25')).toBe(1);
    expect(diasEntre('2026-10-19', '2026-10-25')).toBe(7);
  });

  it('monta os períodos prontos', () => {
    expect(intervalo('hoje', agora)).toEqual({ de: '2026-10-25', ate: '2026-10-25' });
    expect(intervalo('ontem', agora)).toEqual({ de: '2026-10-24', ate: '2026-10-24' });
    expect(intervalo('7dias', agora)).toEqual({ de: '2026-10-19', ate: '2026-10-25' });
    expect(intervalo('30dias', agora)).toEqual({ de: '2026-09-26', ate: '2026-10-25' });
    expect(intervalo('mes', agora)).toEqual({ de: '2026-10-01', ate: '2026-10-25' });
    expect(intervalo('ano', agora)).toEqual({ de: '2026-01-01', ate: '2026-10-25' });
  });

  it('formata o dia curto', () => {
    expect(diaCurto('2026-10-05')).toBe('05/10');
  });
});

describe('série do gráfico', () => {
  it('preenche com zero os dias sem venda', () => {
    const porDia = [
      { dia: '2026-10-19', vendas_centavos: 10000, contas: 2 },
      { dia: '2026-10-21', vendas_centavos: 5000, contas: 1 },
    ];
    const { tipo, pontos } = serieDoGrafico(porDia, '2026-10-19', '2026-10-22');
    expect(tipo).toBe('dia');
    expect(pontos.map((p) => p.vendas)).toEqual([10000, 0, 5000, 0]);
    expect(pontos.map((p) => p.rotulo)).toEqual(['19/10', '20/10', '21/10', '22/10']);
  });

  it('agrupa por mês quando o período passa de 62 dias', () => {
    const porDia = [
      { dia: '2026-01-10', vendas_centavos: 1000, contas: 1 },
      { dia: '2026-01-20', vendas_centavos: 2000, contas: 2 },
      { dia: '2026-03-05', vendas_centavos: 500, contas: 1 },
    ];
    const { tipo, pontos } = serieDoGrafico(porDia, '2026-01-01', '2026-03-31');
    expect(tipo).toBe('mes');
    expect(pontos.map((p) => p.rotulo)).toEqual(['jan/26', 'fev/26', 'mar/26']);
    expect(pontos.map((p) => p.vendas)).toEqual([3000, 0, 500]);
    expect(pontos.map((p) => p.contas)).toEqual([3, 0, 1]);
  });

  it('período sem nenhuma venda devolve colunas zeradas', () => {
    const { pontos } = serieDoGrafico([], '2026-10-25', '2026-10-25');
    expect(pontos).toHaveLength(1);
    expect(pontos[0].vendas).toBe(0);
  });
});

describe('escala e números', () => {
  it('escolhe um topo redondo que cobre o maior valor', () => {
    const e1 = escalaY(213600); // R$ 2.136
    expect(e1.topo).toBeGreaterThanOrEqual(213600);
    expect(e1.marcas[0]).toBe(0);
    expect(e1.marcas.length).toBeGreaterThanOrEqual(3);
    const e2 = escalaY(9500); // R$ 95
    expect(e2.topo).toBeGreaterThanOrEqual(9500);
    expect(e2.topo).toBeLessThanOrEqual(15000);
  });

  it('não quebra com zero', () => {
    const e = escalaY(0);
    expect(e.marcas[0]).toBe(0);
    expect(e.topo).toBeGreaterThan(0);
  });

  it('compacta valores para o eixo', () => {
    expect(compactarReais(0)).toBe('R$ 0');
    expect(compactarReais(50000)).toBe('R$ 500');
    expect(compactarReais(100000)).toBe('R$ 1 mil');
    expect(compactarReais(150000)).toBe('R$ 1,5 mil');
  });

  it('calcula participação e ticket médio', () => {
    expect(participacao(198300, 213600)).toBe(92.8);
    expect(participacao(10, 0)).toBe(0);
    expect(ticketMedio(213600, 26)).toBe(8215);
    expect(ticketMedio(0, 0)).toBe(0);
  });
});
