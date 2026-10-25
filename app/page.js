'use client';

import Link from 'next/link';
import { useSessao } from './componentes/Sessao';
import { TELAS_SO_DO_DONO, podeAcessar } from '../lib/permissoes';

const ATALHOS = [
  ['/garcom', 'Garçom', 'Escolher a mesa e lançar o pedido.'],
  ['/cozinha', 'Cozinha', 'Pedidos da cozinha, em tempo real.'],
  ['/churrasqueira', 'Churrasqueira', 'Espetos e jantinhas, em tempo real.'],
  ['/mesas', 'Mesas', 'Contas abertas, entrega e histórico.'],
  ['/caixa', 'Caixa', 'Conferir a conta, receber e fechar.'],
  ['/vendas', 'Vendas', 'Quanto vendeu, o que mais saiu e como foi pago.'],
  ['/estoque', 'Estoque', 'Entradas, perdas, contagem e o que está acabando.'],
  ['/produtos', 'Produtos', 'Cardápio: preços, setores e o que está à venda.'],
  ['/equipe', 'Equipe', 'Quem tem acesso e o que cada um pode fazer.'],
];

export default function Inicio() {
  const { loginObrigatorio, perfil } = useSessao();
  // Sem a trava, o protótipo continua aberto (menos "Equipe", que é só do dono).
  const atalhos = ATALHOS.filter(([href]) =>
    loginObrigatorio ? podeAcessar(perfil, href) : !TELAS_SO_DO_DONO.includes(href) || perfil === 'dono'
  );
  return (
    <>
      <h1>Bem-vindo ao Jarrão</h1>
      <p className="mudo">
        {loginObrigatorio ? 'Escolha uma tela:' : 'Protótipo com dados fictícios. Escolha uma tela:'}
      </p>
      <div className="atalhos">
        {atalhos.map(([href, nome, descricao]) => (
          <Link key={href} href={href} className="atalho">
            <strong>{nome}</strong>
            <span className="mudo">{descricao}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
