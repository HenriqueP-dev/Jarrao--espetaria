'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useSessao } from '../componentes/Sessao';
import { PERFIS } from '../../lib/permissoes';

// Só o dono: dar perfil a quem já tem acesso, desativar pessoas e ligar a trava do login.
// O banco confere tudo de novo (funções equipe, definir_perfil, definir_login_obrigatorio).
export default function Equipe() {
  const { perfil, loginObrigatorio, recarregar } = useSessao();
  const [equipe, setEquipe] = useState([]);
  const [novos, setNovos] = useState([]);
  const [edicao, setEdicao] = useState({}); // user_id -> { nome, perfil, ativo }
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [confirmandoTrava, setConfirmandoTrava] = useState(false);

  const carregar = useCallback(async () => {
    const [eq, nv] = await Promise.all([supabase.rpc('equipe'), supabase.rpc('usuarios_sem_perfil')]);
    if (eq.error || nv.error) return setErro((eq.error || nv.error).message);
    setErro(null);
    setEquipe(eq.data);
    setNovos(nv.data);
  }, []);

  useEffect(() => {
    if (perfil === 'dono') carregar();
  }, [perfil, carregar]);

  if (perfil !== 'dono') {
    return (
      <>
        <h1>Equipe</h1>
        <div className="aviso">
          <p>Só o dono usa esta tela.</p>
          <Link href="/entrar">Entrar como dono</Link>
        </div>
      </>
    );
  }

  const valorDe = (id, padrao) => ({ ...padrao, ...edicao[id] });
  const mudar = (id, padrao, campos) => setEdicao((e) => ({ ...e, [id]: { ...valorDe(id, padrao), ...campos } }));

  async function salvar(id, dados, mensagem) {
    const { error } = await supabase.rpc('definir_perfil', {
      p_user: id,
      p_nome: dados.nome.trim(),
      p_perfil: dados.perfil,
      p_ativo: dados.ativo,
    });
    if (error) return setErro(error.message);
    setErro(null);
    setAviso(mensagem);
    setEdicao((e) => {
      const { [id]: _, ...resto } = e;
      return resto;
    });
    carregar();
  }

  async function mudarTrava() {
    const { error } = await supabase.rpc('definir_login_obrigatorio', { p_valor: !loginObrigatorio });
    setConfirmandoTrava(false);
    if (error) return setErro(error.message);
    setErro(null);
    setAviso(loginObrigatorio ? 'Sistema voltou ao modo aberto.' : 'A partir de agora todos precisam entrar.');
    recarregar();
  }

  return (
    <>
      <h1>Equipe</h1>
      {erro && <div className="erro" role="alert">{erro}</div>}
      {aviso && <div className="ok">{aviso}</div>}

      <section className="card">
        <h2>Aguardando liberação</h2>
        <p className="mudo">
          Para criar um acesso novo: no painel do Supabase, abra <b>Authentication → Users → Add user</b> e
          cadastre o e-mail e a senha. A pessoa aparece aqui para você escolher o perfil.
        </p>
        {!novos.length && <p className="mudo">Ninguém aguardando.</p>}
        {novos.map((u) => {
          const v = valorDe(u.id, { nome: '', perfil: 'garcom', ativo: true });
          return (
            <div key={u.id} className="equipe-linha">
              <div className="equipe-quem"><b>{u.email}</b></div>
              <input
                value={v.nome}
                onChange={(e) => mudar(u.id, { nome: '', perfil: 'garcom', ativo: true }, { nome: e.target.value })}
                placeholder="Nome (aparece no histórico)"
                aria-label={`Nome de ${u.email}`}
              />
              <select
                value={v.perfil}
                onChange={(e) => mudar(u.id, { nome: '', perfil: 'garcom', ativo: true }, { perfil: e.target.value })}
                aria-label={`Perfil de ${u.email}`}
              >
                {Object.entries(PERFIS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
              </select>
              <button disabled={!v.nome.trim()} onClick={() => salvar(u.id, v, `Acesso de ${v.nome.trim()} liberado.`)}>
                Liberar
              </button>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2>Quem já tem acesso</h2>
        {!equipe.length && <p className="mudo">Ninguém ainda.</p>}
        {equipe.map((p) => {
          const padrao = { nome: p.nome, perfil: p.perfil, ativo: p.ativo };
          const v = valorDe(p.user_id, padrao);
          const mudou = v.nome !== p.nome || v.perfil !== p.perfil || v.ativo !== p.ativo;
          return (
            <div key={p.user_id} className="equipe-linha">
              <div className="equipe-quem">
                <b>{p.email}</b>
                {!p.ativo && <span className="tag cancelado">Desativado</span>}
              </div>
              <input
                value={v.nome}
                onChange={(e) => mudar(p.user_id, padrao, { nome: e.target.value })}
                aria-label={`Nome de ${p.email}`}
              />
              <select
                value={v.perfil}
                onChange={(e) => mudar(p.user_id, padrao, { perfil: e.target.value })}
                aria-label={`Perfil de ${p.email}`}
              >
                {Object.entries(PERFIS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
              </select>
              <label className="equipe-ativo">
                <input
                  type="checkbox"
                  checked={v.ativo}
                  onChange={(e) => mudar(p.user_id, padrao, { ativo: e.target.checked })}
                />
                Ativo
              </label>
              <button disabled={!mudou || !v.nome.trim()} onClick={() => salvar(p.user_id, v, `${v.nome.trim()} atualizado.`)}>
                Salvar
              </button>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2>Trava do login</h2>
        <p>
          Agora o sistema está <b>{loginObrigatorio ? 'exigindo login' : 'aberto (sem exigir login)'}</b>.
        </p>
        {!confirmandoTrava ? (
          <>
            <p className="mudo">
              {loginObrigatorio
                ? 'Voltar ao modo aberto libera o sistema para quem não entrou.'
                : 'Antes de exigir login, confira que todo mundo já tem acesso liberado acima e sabe a própria senha. Quem não tiver acesso ficará de fora.'}
            </p>
            <button className={loginObrigatorio ? 'sec' : ''} onClick={() => setConfirmandoTrava(true)}>
              {loginObrigatorio ? 'Voltar ao modo aberto' : 'Exigir login de todos'}
            </button>
          </>
        ) : (
          <>
            <p>
              <b>Tem certeza?</b>{' '}
              {loginObrigatorio
                ? 'O sistema volta a funcionar sem exigir login.'
                : 'Daqui em diante só entra quem fizer login e tiver perfil ativo.'}
            </p>
            <div className="linha">
              <button onClick={mudarTrava}>Sim, confirmar</button>
              <button className="sec" onClick={() => setConfirmandoTrava(false)}>Voltar</button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
