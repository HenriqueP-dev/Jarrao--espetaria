// Mesas 1 a 8 e 10 a 23 (não existe a mesa 9).
export const MESAS = [
  ...Array.from({ length: 8 }, (_, i) => i + 1),
  ...Array.from({ length: 14 }, (_, i) => i + 10),
];

export function mesaValida(numero) {
  return MESAS.includes(numero);
}
