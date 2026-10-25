// Lógica da tela de vendas (/vendas): períodos, série do gráfico e escala.
// Os números vêm da função relatorio_vendas do banco (migration 007).
// HIPÓTESE (ver docs/DECISOES.md): o dia é o dia em que a conta foi fechada,
// no horário de Brasília.

const FUSO = 'America/Sao_Paulo';

// Data de hoje (AAAA-MM-DD) no horário de Brasília, igual ao que o banco usa.
export function hojeISO(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

const paraUTC = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const deUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

export function somarDias(iso, n) {
  return deUTC(paraUTC(iso) + n * 86400000);
}

export function diasEntre(de, ate) {
  return Math.round((paraUTC(ate) - paraUTC(de)) / 86400000) + 1;
}

export const PERIODOS = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'ontem', rotulo: 'Ontem' },
  { id: '7dias', rotulo: '7 dias' },
  { id: '30dias', rotulo: '30 dias' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'ano', rotulo: 'Este ano' },
];

// Intervalo { de, ate } de um período pronto, a partir de hoje.
export function intervalo(periodo, agora = new Date()) {
  const hoje = hojeISO(agora);
  switch (periodo) {
    case 'ontem': {
      const ontem = somarDias(hoje, -1);
      return { de: ontem, ate: ontem };
    }
    case '7dias':
      return { de: somarDias(hoje, -6), ate: hoje };
    case '30dias':
      return { de: somarDias(hoje, -29), ate: hoje };
    case 'mes':
      return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
    case 'ano':
      return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje };
    default:
      return { de: hoje, ate: hoje };
  }
}

// "2026-10-25" -> "25/10"
export function diaCurto(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Pontos do gráfico de colunas. Períodos de até 62 dias: uma coluna por dia
// (dias sem venda entram com zero, para o tempo não "pular"). Períodos maiores:
// uma coluna por mês.
export function serieDoGrafico(porDia, de, ate) {
  const mapa = new Map(porDia.map((d) => [d.dia, d]));
  if (diasEntre(de, ate) <= 62) {
    const pontos = [];
    for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) {
      const d = mapa.get(dia);
      pontos.push({
        chave: dia,
        rotulo: diaCurto(dia),
        vendas: Number(d?.vendas_centavos ?? 0),
        contas: Number(d?.contas ?? 0),
      });
    }
    return { tipo: 'dia', pontos };
  }

  const meses = new Map();
  for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) {
    const mes = dia.slice(0, 7);
    if (!meses.has(mes)) {
      meses.set(mes, {
        chave: mes,
        rotulo: `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`,
        vendas: 0,
        contas: 0,
      });
    }
  }
  for (const d of porDia) {
    const p = meses.get(d.dia.slice(0, 7));
    if (p) {
      p.vendas += Number(d.vendas_centavos);
      p.contas += Number(d.contas);
    }
  }
  return { tipo: 'mes', pontos: [...meses.values()] };
}

// Escala do eixo vertical: topo "redondo" e marcas em reais inteiros (em centavos).
export function escalaY(maxCentavos) {
  const maxReais = Math.max(1, Math.ceil(maxCentavos / 100));
  const bruto = maxReais / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((f) => f * potencia).find((p) => p >= bruto);
  const marcas = [];
  for (let v = 0; v <= maxReais + passo - 1; v += passo) {
    marcas.push(v * 100);
    if (v >= maxReais) break;
  }
  return { topo: marcas[marcas.length - 1], marcas };
}

// 0 -> "R$ 0"; 500 reais -> "R$ 500"; 1.500 reais -> "R$ 1,5 mil"
export function compactarReais(centavos) {
  const reais = centavos / 100;
  if (reais < 1000) return `R$ ${Math.round(reais)}`;
  const mil = reais / 1000;
  const texto = Number.isInteger(mil) ? String(mil) : mil.toFixed(1).replace('.', ',');
  return `R$ ${texto} mil`;
}

// Fatia (0 a 100, uma casa decimal) de um valor no total.
export function participacao(valor, total) {
  if (!total) return 0;
  return Math.round((valor / total) * 1000) / 10;
}

// Ticket médio em centavos (arredondado); 0 se não houve conta paga.
export function ticketMedio(vendasCentavos, contas) {
  return contas ? Math.round(vendasCentavos / contas) : 0;
}
