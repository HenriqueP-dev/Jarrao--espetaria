import Link from 'next/link';

export default function Inicio() {
  return (
    <>
      <h1>Jarrão Espetaria</h1>
      <p className="mudo">Protótipo com dados fictícios.</p>
      <nav>
        <Link href="/garcom">Garçom (fazer pedido)</Link>
        <Link href="/cozinha">Cozinha</Link>
        <Link href="/churrasqueira">Churrasqueira</Link>
        <Link href="/mesas">Mesas e contas</Link>
        <Link href="/caixa">Caixa</Link>
      </nav>
    </>
  );
}
