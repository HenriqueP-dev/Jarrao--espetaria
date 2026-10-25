'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/garcom', 'Garçom'],
  ['/cozinha', 'Cozinha'],
  ['/churrasqueira', 'Churrasqueira'],
  ['/mesas', 'Mesas'],
  ['/caixa', 'Caixa'],
  ['/vendas', 'Vendas'],
];

// Cabeçalho fixo com o logo e o menu. A aba da página atual fica em amarelo.
export default function Cabecalho() {
  const caminho = usePathname();
  return (
    <header className="topo">
      <div className="topo-conteudo">
        <Link href="/" aria-label="Jarrão Espetaria, início">
          <Image
            src="/logo.png"
            alt="Jarrão Espetaria, Bar e Espeto"
            width={650}
            height={370}
            priority
            className="logo"
          />
        </Link>
        <nav className="menu" aria-label="Telas do sistema">
          {LINKS.map(([href, rotulo]) => (
            <Link
              key={href}
              href={href}
              className={caminho === href ? 'ativo' : ''}
              aria-current={caminho === href ? 'page' : undefined}
            >
              {rotulo}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
