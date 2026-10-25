'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSessao } from './Sessao';
import { PERFIS, decidirAcesso, paginaInicial } from '../../lib/permissoes';

// Porteiro da tela. Com a trava do login DESLIGADA não muda nada (todo mundo entra,
// como no protótipo). Com a trava LIGADA, manda quem não entrou para /entrar e
// mostra um aviso a quem não pode ver aquela tela. É só conforto: o banco é quem
// realmente barra (migration 008). A decisão fica em lib/permissoes.js (testada).
export default function Guarda({ children }) {
  const { carregando, loginObrigatorio, usuario, perfil, sair } = useSessao();
  const caminho = usePathname();
  const router = useRouter();

  const decisao = decidirAcesso({ carregando, loginObrigatorio, usuario, perfil, caminho });
  useEffect(() => {
    if (decisao === 'entrar') router.replace('/entrar');
  }, [decisao, router]);

  if (decisao === 'carregando') return <p className="mudo">Carregando…</p>;
  if (decisao === 'entrar') return null; // está sendo mandado para /entrar

  if (decisao === 'sem_perfil') {
    return (
      <div className="aviso">
        <p><b>Seu usuário ainda não tem acesso.</b> Peça ao dono para liberar o seu perfil.</p>
        <button className="sec" onClick={sair}>Sair</button>
      </div>
    );
  }

  if (decisao === 'sem_permissao') {
    return (
      <div className="aviso">
        <p>O perfil <b>{PERFIS[perfil]}</b> não usa esta tela.</p>
        <Link href={paginaInicial(perfil)}>Ir para a minha tela</Link>
      </div>
    );
  }

  return children;
}
