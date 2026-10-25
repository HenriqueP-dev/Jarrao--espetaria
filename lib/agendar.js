// Junta chamadas em rajada numa só. Exemplo: um pedido com 6 itens gera 6 avisos de tempo
// real; sem isto, cada tela aberta recarregaria tudo 6 vezes seguidas. Com isto, recarrega
// uma vez, `espera` milissegundos depois do primeiro aviso.
export function agruparChamadas(fn, espera = 300) {
  let timer = null;
  const chamar = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, espera);
  };
  chamar.cancelar = () => {
    clearTimeout(timer);
    timer = null;
  };
  return chamar;
}
