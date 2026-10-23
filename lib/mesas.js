// A mesa é um número livre, digitado pelo garçom. Às vezes o restaurante
// "empresta" mesas do vizinho, então a lista não é fixa (antes: 1 a 8 e 10 a 23).
// Mantenha igual à função criar_pedido no SQL (migration 005).

export const MESA_MAXIMA = 999;

export function mesaValida(numero) {
  return Number.isInteger(numero) && numero >= 1 && numero <= MESA_MAXIMA;
}

// Lê o campo único do garçom: "12" ou "12/João" (mesa e, opcionalmente, pessoa).
// Retorna { mesa, pessoa } (pessoa é null quando não informada) ou { erro }.
export function lerMesaPessoa(texto) {
  const entrada = String(texto ?? '').trim();
  const achou = entrada.match(/^(\d+)\s*(?:\/\s*(.*))?$/);
  if (!achou) return { erro: 'Digite a mesa assim: 12 ou 12/João.' };
  const mesa = Number(achou[1]);
  if (!mesaValida(mesa)) return { erro: `A mesa deve ser um número de 1 a ${MESA_MAXIMA}.` };
  return { mesa, pessoa: achou[2]?.trim() || null };
}
