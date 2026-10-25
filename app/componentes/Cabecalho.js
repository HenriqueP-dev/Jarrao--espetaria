'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSessao } from './Sessao';
import { PERFIS, linksDoMenu } from '../../lib/permissoes';

const LINKS = [
  ['/garcom', 'Garçom'],
  ['/cozinha', 'Cozinha'],
  ['/churrasqueira', 'Churrasqueira'],
  ['/mesas', 'Mesas'],
  ['/caixa', 'Caixa'],
  ['/vendas', 'Vendas'],
  ['/estoque', 'Estoque'],
  ['/produtos', 'Produtos'],
  ['/equipe', 'Equipe'],
];

// Cabeçalho fixo com o logo, o menu e quem está logado. A aba da página atual fica em amarelo.
// Com a trava do login desligada, o menu mostra tudo (como no protótipo); com ela ligada,
// mostra só as telas do perfil. "Equipe" aparece só para o dono.
export default function Cabecalho() {
  const caminho = usePathname();
  const { carregando, loginObrigatorio, usuario, perfil, nome, sair } = useSessao();

  const links = linksDoMenu(LINKS, { carregando, loginObrigatorio, perfil });

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
          {links.map(([href, rotulo]) => (
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
        {!carregando && usuario && (
          <div className="usuario">
            <span>
              <b>{nome ?? usuario.email}</b>
              {perfil && <small>{PERFIS[perfil]}</small>}
            </span>
            <Link href="/senha" className="senha-link">Trocar senha</Link>
            <button className="sec" onClick={sair}>Sair</button>
          </div>
        )}
        {!carregando && !usuario && !loginObrigatorio && caminho !== '/entrar' && (
          <Link href="/entrar" className="entrar-link">Entrar</Link>
        )}
      </div>
    </header>
  );
}
