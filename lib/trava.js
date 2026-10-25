// Evita que o mesmo botão rode duas vezes ao mesmo tempo (toque duplo, tela lenta).
// Enquanto uma ação está em andamento, as outras chamadas são ignoradas. Fica fora do
// React para poder ser testada; o hook useTrava (app/componentes/useTrava.js) usa isto.

export function criarTrava(aoMudar = () => {}) {
  let ocupado = false;
  return {
    get ocupado() {
      return ocupado;
    },
    // Roda a ação se não houver outra em andamento. Devolve o resultado da ação,
    // ou undefined quando a chamada foi ignorada. Libera a trava mesmo se a ação falhar.
    async executar(acao) {
      if (ocupado) return undefined;
      ocupado = true;
      aoMudar(true);
      try {
        return await acao();
      } finally {
        ocupado = false;
        aoMudar(false);
      }
    },
  };
}
