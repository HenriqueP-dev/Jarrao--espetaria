import Link from 'next/link';

const ATALHOS = [
  ['/garcom', 'Garçom', 'Escolher a mesa e lançar o pedido.'],
  ['/cozinha', 'Cozinha', 'Pedidos da cozinha, em tempo real.'],
  ['/churrasqueira', 'Churrasqueira', 'Espetos e jantinhas, em tempo real.'],
  ['/mesas', 'Mesas', 'Contas abertas, entrega e histórico.'],
  ['/caixa', 'Caixa', 'Conferir a conta, receber e fechar.'],
  ['/vendas', 'Vendas', 'Quanto vendeu, o que mais saiu e como foi pago.'],
];

export default function Inicio() {
  return (
    <>
      <h1>Bem-vindo ao Jarrão</h1>
      <p className="mudo">Protótipo com dados fictícios. Escolha uma tela:</p>
      <div className="atalhos">
        {ATALHOS.map(([href, nome, descricao]) => (
          <Link key={href} href={href} className="atalho">
            <strong>{nome}</strong>
            <span className="mudo">{descricao}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
