'use client';

import { useMemo, useState } from 'react';
import { criarTrava } from '../../lib/trava';

// Uso: const { ocupado, travar } = useTrava();
//      <button disabled={ocupado} onClick={() => travar(minhaAcao)}>
// A segunda chamada enquanto a primeira não terminou é ignorada (mesmo antes da tela atualizar).
export function useTrava() {
  const [ocupado, setOcupado] = useState(false);
  const trava = useMemo(() => criarTrava(setOcupado), []);
  return { ocupado, travar: trava.executar };
}
