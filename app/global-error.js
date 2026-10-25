'use client';

// Último recurso: erro no próprio layout (cabeçalho, sessão). Esta página não recebe o
// globals.css, por isso os estilos ficam aqui mesmo, nas cores do Jarrão.
export default function ErroGeral({ error, retry }) {
  console.error(error);
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: '#faf7f2', color: '#231f1c', fontFamily: 'system-ui, sans-serif' }}>
        <title>Erro · Jarrão Espetaria</title>
        <main style={{ maxWidth: 480, margin: '15vh auto', padding: 16 }}>
          <h1 style={{ fontSize: 24 }}>O sistema encontrou um erro</h1>
          <p>Nada do que já foi gravado se perdeu. Toque abaixo para tentar de novo.</p>
          <button
            onClick={() => retry()}
            style={{ padding: '12px 20px', fontSize: 16, background: '#c2410c', color: '#fff', border: 0, borderRadius: 8 }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
