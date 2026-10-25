import Link from 'next/link';

export const metadata = { title: 'Página não encontrada · Jarrão Espetaria' };

// Página 404: endereço digitado errado ou tela que não existe.
export default function NaoEncontrada() {
  return (
    <div className="aviso">
      <h1>Página não encontrada</h1>
      <p>Esse endereço não existe no sistema. Confira o que foi digitado.</p>
      <Link href="/">Voltar ao início</Link>
    </div>
  );
}
