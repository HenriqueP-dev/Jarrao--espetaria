'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useSessao } from '../componentes/Sessao';
import { validarNovaSenha, traduzirErroSenha, SENHA_MINIMA } from '../../lib/senha';

// Cada pessoa troca a PRÓPRIA senha. Quem esqueceu a senha pede ao dono para recriar o acesso
// no painel do Supabase (não há recuperação por e-mail por enquanto).
export default function Senha() {
  const { usuario, nome } = useSessao();
  const [nova, setNova] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erro, setErro] = useState(null);
  const [pronto, setPronto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (!usuario) {
    return (
      <>
        <h1>Trocar minha senha</h1>
        <div className="aviso">
          <p>Entre no sistema para trocar a sua senha.</p>
          <Link href="/entrar">Entrar</Link>
        </div>
      </>
    );
  }

  async function trocar(evento) {
    evento.preventDefault();
    const problema = validarNovaSenha(nova, repetida);
    if (problema) return setErro(problema);
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: nova });
    setEnviando(false);
    if (error) return setErro(traduzirErroSenha(error));
    setNova('');
    setRepetida('');
    setPronto(true);
  }

  return (
    <>
      <h1>Trocar minha senha</h1>
      <p className="mudo">Você está entrando como <b>{nome ?? usuario.email}</b>.</p>
      {pronto && <div className="ok">Senha trocada. Use a nova senha na próxima vez que entrar.</div>}
      {erro && <div className="erro" role="alert">{erro}</div>}
      <form onSubmit={trocar} className="form-entrar">
        <label>
          <span className="rotulo-campo">Nova senha (pelo menos {SENHA_MINIMA} caracteres, com letras e números)</span>
          <input
            type="password"
            value={nova}
            onChange={(e) => { setNova(e.target.value); setPronto(false); }}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          <span className="rotulo-campo">Repita a nova senha</span>
          <input
            type="password"
            value={repetida}
            onChange={(e) => { setRepetida(e.target.value); setPronto(false); }}
            autoComplete="new-password"
            required
          />
        </label>
        <button type="submit" className="grande" disabled={enviando || !nova || !repetida}>
          {enviando ? 'Trocando…' : 'Trocar senha'}
        </button>
      </form>
      <p className="mudo">Esqueceu a senha? Peça ao dono para criar um acesso novo para você.</p>
    </>
  );
}
