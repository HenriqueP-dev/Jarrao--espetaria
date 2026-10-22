import { mesaValida } from './mesas.js';

export function formatarReais(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Total registrado na conta. Itens cancelados não entram.
// É o valor dos itens registrados, não um pagamento confirmado.
export function totalConta(itens) {
  return itens
    .filter((i) => i.estado !== 'cancelado')
    .reduce((soma, i) => soma + i.preco_centavos * i.quantidade, 0);
}

// Valida o rascunho do pedido antes de enviar ao banco.
// Retorna uma mensagem de erro ou null se estiver ok.
export function validarPedido(mesa, itens) {
  if (!mesaValida(mesa)) return 'Escolha uma mesa válida.';
  if (!itens.length) return 'Adicione ao menos um item.';
  if (itens.some((i) => !Number.isInteger(i.quantidade) || i.quantidade < 1)) {
    return 'Quantidade inválida.';
  }
  return null;
}
