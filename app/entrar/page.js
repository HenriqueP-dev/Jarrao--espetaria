'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useSessao } from '../componentes/Sessao';
import { PERFIS, paginaInicial, traduzirErroLogin } from '../../lib/permissoes';

// Tela de entrada com e-mail e senha (Supabase Auth). Os acessos são criados pelo
// dono no painel do Supabase; o perfil de cada pessoa é definido em /equipe.
export default function Entrar() {
  const { usuario, perfil, nome, loginObrigatorio, recarregar, sair } = useSessao();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      setEnviando(false);
      setErro(traduzirErroLogin(error));
      return;
    }
    const { data: linha } = await supabase
      .from('perfis')
      .select('perfil, ativo')
      .eq('user_id', data.user.id)
      .maybeSingle();
    await recarregar();
    setEnviando(false);
    router.replace(linha?.ativo ? paginaInicial(linha.perfil) : '/');
  }

  if (usuario) {
    return (
      <>
        <h1>Você já entrou</h1>
        <p>
          <b>{nome ?? usuario.email}</b>
          {perfil ? <> · {PERFIS[perfil]}</> : ' · ainda sem perfil liberado'}
        </p>
        <div className="linha">
          <Link href={perfil ? paginaInicial(perfil) : '/'} className="botao-link">Continuar</Link>
          <button className="sec" onClick={sair}>Sair</button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Entrar</h1>
      <p className="mudo">
        {loginObrigatorio
          ? 'Use o e-mail e a senha que o dono liberou para você.'
          : 'Entrar é opcional por enquanto, mas assim o seu nome fica registrado nas ações.'}
      </p>
      {erro && <div className="erro" role="alert">{erro}</div>}
      <form onSubmit={entrar} className="form-entrar">
        <label>
          <span className="rotulo-campo">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          <span className="rotulo-campo">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" className="grande" disabled={enviando || !email || !senha}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="mudo">Esqueceu a senha? Peça ao dono para criar uma nova.</p>
    </>
  );
}
