'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Erro inesperado numa tela (o cabeçalho continua funcionando). Nesta versão do Next o
// botão de tentar de novo se chama `retry` (ver node_modules/next/dist/docs, error.md).
export default function ErroDaTela({ error, retry }) {
  useEffect(() => {
    console.error(error); // aparece no console do navegador (F12) para quem for investigar
  }, [error]);

  return (
    <div className="erro" role="alert">
      <h1>Algo deu errado nesta tela</h1>
      <p>
        Nada do que já foi gravado se perdeu. Tente de novo; se continuar, recarregue a página ou volte
        ao início.
      </p>
      <div className="linha">
        <button onClick={() => retry()}>Tentar de novo</button>
        <Link href="/">Voltar ao início</Link>
      </div>
    </div>
  );
}
