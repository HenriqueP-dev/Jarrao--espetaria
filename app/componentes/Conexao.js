'use client';

import { useEffect, useState } from 'react';

// Faixa fixa avisando quando o aparelho está sem internet. Os botões continuam funcionando,
// mas o envio vai falhar até a conexão voltar (pedido e pagamento não duplicam ao repetir).
export default function Conexao() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine);
    atualizar();
    window.addEventListener('online', atualizar);
    window.addEventListener('offline', atualizar);
    return () => {
      window.removeEventListener('online', atualizar);
      window.removeEventListener('offline', atualizar);
    };
  }, []);

  if (online) return null;
  return (
    <div className="sem-conexao" role="status" aria-live="polite">
      Sem internet: nada é enviado até a conexão voltar.
    </div>
  );
}
