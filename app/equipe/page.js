'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { mensagemDeErro } from '../../lib/erros';
import { useSessao } from '../componentes/Sessao';
import { PERFIS } from '../../lib/permissoes';
import { TABELAS_DA_COPIA, chaveDaTabela, lerTudo, montarCopia, nomeDoArquivo } from '../../lib/copia';
import { useTrava } from '../componentes/useTrava';

// Só o dono: dar perfil a quem já tem acesso e desativar pessoas.
// O banco confere tudo de novo (funções equipe e definir_perfil). O login é sempre exigido
// (migration 013): não existe mais o botão de voltar ao modo aberto.
export default function Equipe() {
  const { perfil } = useSessao();
  const [equipe, setEquipe] = useState([]);
  const [novos, setNovos] = useState([]);
  const [edicao, setEdicao] = useState({}); // user_id -> { nome, perfil, ativo }
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const { ocupado: gerandoCopia, travar } = useTrava();

  // Cópia de segurança: lê todas as tabelas (em lotes) e baixa um arquivo .json.
  function baixarCopia() {
    return travar(async () => {
      try {
        const tabelas = {};
        for (const t of TABELAS_DA_COPIA) {
          tabelas[t] = await lerTudo((de, ate) =>
            supabase.from(t).select('*').order(chaveDaTabela(t)).range(de, ate)
          );
        }
        const agora = new Date();
        const arquivo = new Blob([JSON.stringify(montarCopia(tabelas, agora), null, 1)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(arquivo);
        link.download = nomeDoArquivo(agora);
        link.click();
        URL.revokeObjectURL(link.href);
        setErro(null);
        setAviso(`Cópia baixada (${link.download}). Guarde em outro lugar além deste aparelho.`);
      } catch (e) {
        setErro(mensagemDeErro(e));
      }
    });
  }

  const carregar = useCallback(async () => {
    const [eq, nv] = await Promise.all([supabase.rpc('equipe'), supabase.rpc('usuarios_sem_perfil')]);
    if (eq.error || nv.error) return setErro(mensagemDeErro(eq.error || nv.error));
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
    if (error) return setErro(mensagemDeErro(error));
    setErro(null);
    setAviso(mensagem);
    setEdicao((e) => {
      const { [id]: _, ...resto } = e;
      return resto;
    });
    carregar();
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
        <h2>Cópia de segurança</h2>
        <p className="mudo">
          Baixa um arquivo com todos os pedidos, contas, pagamentos, estoque e histórico. Faça ao fim de cada
          semana e guarde fora deste aparelho (e-mail, Google Drive, pendrive). As senhas não vão no arquivo.
        </p>
        <button onClick={baixarCopia} disabled={gerandoCopia}>
          {gerandoCopia ? 'Gerando…' : 'Baixar cópia de segurança'}
        </button>
      </section>

      <section className="card">
        <h2>Login</h2>
        <p className="mudo">
          O login é sempre exigido: só entra quem tem acesso e perfil ativo. Para tirar alguém, desmarque
          &quot;Ativo&quot; acima (vale na hora). Se alguém esquecer a senha, redefina no painel do Supabase
          (Authentication → Users).
        </p>
      </section>
    </>
  );
}
