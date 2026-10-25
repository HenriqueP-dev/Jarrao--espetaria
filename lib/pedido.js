// Montagem do pedido na tela do garçom (antes de enviar ao banco).
// Uma "linha" é um item do rascunho: { chave, produto, quantidade, espeto, obs }.

// Tetos (hipótese a confirmar com o dono). Mantenha iguais a criar_pedido no SQL (migration 012).
export const QUANTIDADE_MAXIMA = 99;
export const LINHAS_MAXIMAS = 60;

// Adiciona um produto ao rascunho. Produtos iguais e sem observação somam a
// quantidade; a jantinha (exige_espeto) sempre ganha linha própria, porque
// cada prato pode ter um espeto diferente.
export function adicionarProduto(linhas, produto, chave) {
  if (!produto.exige_espeto) {
    const i = linhas.findIndex((l) => l.produto.id === produto.id && !l.obs);
    if (i >= 0) {
      return linhas.map((l, j) => (j === i ? { ...l, quantidade: l.quantidade + 1 } : l));
    }
  }
  return [...linhas, { chave, produto, quantidade: 1, espeto: '', obs: '' }];
}

// Texto que vai para os setores: "Espeto: Carne · sem vinagrete".
export function detalheDaLinha(linha) {
  return [linha.espeto && `Espeto: ${linha.espeto}`, linha.obs?.trim()]
    .filter(Boolean)
    .join(' · ');
}

// Mensagem de erro do rascunho, ou null se pode enviar.
export function erroDasLinhas(linhas) {
  if (linhas.length > LINHAS_MAXIMAS) {
    return `Pedido com linhas demais (máximo ${LINHAS_MAXIMAS}). Divida em dois pedidos.`;
  }
  if (linhas.some((l) => l.quantidade > QUANTIDADE_MAXIMA)) {
    return `Quantidade acima do limite (máximo ${QUANTIDADE_MAXIMA} por item).`;
  }
  if (linhas.some((l) => l.produto.exige_espeto && !l.espeto)) {
    return 'Escolha o espeto de cada jantinha.';
  }
  return null;
}

// Formato que a função criar_pedido do banco espera.
export function itensParaEnvio(linhas, pessoa) {
  return linhas.map((l) => ({
    produto_id: l.produto.id,
    quantidade: l.quantidade,
    pessoa: pessoa.trim() || null,
    detalhe: detalheDaLinha(l) || null,
  }));
}
