// Regras do caixa.
// HIPÓTESES (ver docs/DECISOES.md):
// - Pagamento parcial é permitido: a conta pode receber mais de um pagamento.
// - Não há troco: o valor registrado não pode passar do total da conta.
// - Pix ainda não entra (não confirmado).
// - Para fechar, todo item precisa estar Entregue ou Cancelado, e a conta
//   precisa estar paga por completo.
// Mantenha igual às funções registrar_pagamento e fechar_conta no SQL.

export const FORMAS_PAGAMENTO = {
  dinheiro: 'Dinheiro',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
};

// Total dos itens que não foram cancelados.
export function totalItens(itens) {
  return itens
    .filter((i) => i.estado !== 'cancelado')
    .reduce((soma, i) => soma + i.preco_centavos * i.quantidade, 0);
}

export function totalPago(pagamentos) {
  return pagamentos.reduce((soma, p) => soma + p.valor_centavos, 0);
}

export function saldo(itens, pagamentos) {
  return totalItens(itens) - totalPago(pagamentos);
}

// Converte o texto digitado ("52,50" ou "52.50") em centavos.
// Retorna null se o texto não for um valor positivo.
export function parseReais(texto) {
  const numero = Number(String(texto).trim().replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return Math.round(numero * 100);
}

// Mensagem explicando por que a conta não pode ser fechada, ou null se pode.
export function motivoNaoFechar(itens, pagamentos) {
  const pendentes = itens.filter((i) => ['novo', 'em_preparo', 'pronto'].includes(i.estado));
  if (pendentes.length) {
    return `Ainda há ${pendentes.length} item(ns) não entregue(s).`;
  }
  if (saldo(itens, pagamentos) !== 0) {
    return 'A conta ainda não está paga por completo.';
  }
  return null;
}

// Mensagem de erro para um pagamento, ou null se pode registrar.
export function validarPagamento(itens, pagamentos, forma, valorCentavos) {
  if (!FORMAS_PAGAMENTO[forma]) return 'Escolha uma forma de pagamento.';
  if (valorCentavos === null) return 'Digite um valor maior que zero.';
  if (valorCentavos > saldo(itens, pagamentos)) {
    return 'O valor passa do saldo da conta. Não há troco no registro.';
  }
  return null;
}
