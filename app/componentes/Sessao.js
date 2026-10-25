'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Guarda quem está logado, qual é o perfil e se a trava do login está ligada.
// Quem realmente protege os dados é o banco; aqui a tela só acompanha.
const Contexto = createContext(null);

export function useSessao() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSessao precisa estar dentro de SessaoProvider');
  return valor;
}

const INICIAL = {
  carregando: true,
  loginObrigatorio: false,
  usuario: null,
  perfil: null, // só vale se o perfil estiver ativo
  nome: null,
};

export default function SessaoProvider({ children }) {
  const [estado, setEstado] = useState(INICIAL);

  const recarregar = useCallback(async () => {
    const [config, sessao] = await Promise.all([
      supabase.from('configuracao').select('exigir_login').maybeSingle(),
      supabase.auth.getSession(),
    ]);
    const usuario = sessao.data?.session?.user ?? null;
    let linha = null;
    if (usuario) {
      const resposta = await supabase
        .from('perfis')
        .select('nome, perfil, ativo')
        .eq('user_id', usuario.id)
        .maybeSingle();
      linha = resposta.data;
    }
    setEstado({
      carregando: false,
      loginObrigatorio: Boolean(config.data?.exigir_login),
      usuario,
      perfil: linha?.ativo ? linha.perfil : null,
      nome: linha?.nome ?? null,
    });
  }, []);

  useEffect(() => {
    recarregar();
    // Não chama o Supabase direto dentro do aviso de mudança de sessão (evita travar).
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(evento)) {
        setTimeout(recarregar, 0);
      }
    });
    const tempo = setInterval(recarregar, 60000); // pega a chave do login ligada ou desligada
    return () => {
      clearInterval(tempo);
      data.subscription.unsubscribe();
    };
  }, [recarregar]);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
    await recarregar();
  }, [recarregar]);

  const valor = useMemo(() => ({ ...estado, recarregar, sair }), [estado, recarregar, sair]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
