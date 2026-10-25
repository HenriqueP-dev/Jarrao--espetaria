// Chave única (UUID) que acompanha um pedido ou pagamento. Se o envio for repetido com a
// mesma chave (internet que caiu, toque duplo), o banco não grava de novo (migration 012).
// crypto.randomUUID só existe em páginas seguras (https/localhost); o plano B cobre o resto.

export function novaChave() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // versão 4
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Guarda a chave de uma tentativa de envio. Enquanto o envio for "o mesmo" (mesma assinatura)
// e ainda não tiver dado certo, repete a chave; depois de dar certo (liberar) ou se mudar o
// conteúdo, gera outra.
export function criarGuardaChave(gerar = novaChave) {
  let atual = null; // { assinatura, chave }
  return {
    para(assinatura) {
      if (!atual || atual.assinatura !== assinatura) atual = { assinatura, chave: gerar() };
      return atual.chave;
    },
    liberar() {
      atual = null;
    },
  };
}
