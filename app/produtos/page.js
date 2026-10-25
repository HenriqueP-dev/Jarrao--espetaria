'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useTrava } from '../componentes/useTrava';
import { useSessao } from '../componentes/Sessao';
import { formatarReais } from '../../lib/conta';
import {
  SETORES,
  categoriasDe,
  centavosParaCampo,
  descreverMudanca,
  filtrarProdutos,
  validarProduto,
} from '../../lib/produtos';

const FORM_NOVO = { nome: '', preco: '', setor: 'cozinha', categoria: '', ativo: true, exige_espeto: false };

// Cardápio: só o dono cria, edita preço e setor e desativa produtos. O banco confere tudo
// de novo (função salvar_produto) e anota cada mudança. Pedidos já lançados não mudam.
export default function Produtos() {
  const { perfil } = useSessao();
  const [produtos, setProdutos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState(null);
  const [editando, setEditando] = useState(null); // id do produto, 'novo' ou null
  const [form, setForm] = useState(FORM_NOVO);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const { ocupado, travar } = useTrava();

  const carregar = useCallback(async () => {
    const [p, h] = await Promise.all([
      supabase.from('produtos').select('*').order('ordem'),
      supabase
        .from('produtos_historico')
        .select('*, produtos(nome)')
        .order('criado_em', { ascending: false })
        .order('id', { ascending: false })
        .limit(40),
    ]);
    if (p.error || h.error) return setErro((p.error || h.error).message);
    setErro(null);
    setProdutos(p.data);
    setHistorico(h.data);
  }, []);

  useEffect(() => {
    if (perfil === 'dono') carregar();
  }, [perfil, carregar]);

  const categorias = useMemo(() => categoriasDe(produtos), [produtos]);
  const visiveis = useMemo(() => filtrarProdutos(produtos, { busca, categoria }), [produtos, busca, categoria]);

  if (perfil !== 'dono') {
    return (
      <>
        <h1>Produtos</h1>
        <div className="aviso">
          <p>Só o dono usa esta tela.</p>
          <Link href="/entrar">Entrar como dono</Link>
        </div>
      </>
    );
  }

  const original = typeof editando === 'number' ? produtos.find((p) => p.id === editando) : null;
  const validacao = validarProduto(form);
  const precoMudou = Boolean(original && validacao.ok && validacao.precoCentavos !== original.preco_centavos);

  function abrir(produto) {
    setErro(null);
    setAviso(null);
    setConfirmando(false);
    if (!produto) {
      setEditando('novo');
      setForm(FORM_NOVO);
      return;
    }
    setEditando(produto.id);
    setForm({
      nome: produto.nome,
      preco: centavosParaCampo(produto.preco_centavos),
      setor: produto.setor,
      categoria: produto.categoria ?? '',
      ativo: produto.ativo,
      exige_espeto: produto.exige_espeto,
    });
  }

  function salvar() {
    return travar(async () => {
      if (validacao.erro) return setErro(validacao.erro);
      const { error } = await supabase.rpc('salvar_produto', {
        p_id: original ? original.id : null,
        p_nome: form.nome.trim(),
        p_preco_centavos: validacao.precoCentavos,
        p_setor: form.setor,
        p_categoria: form.categoria.trim(),
        p_ativo: form.ativo,
        p_exige_espeto: form.exige_espeto,
      });
      setConfirmando(false);
      if (error) return setErro(error.message);
      setErro(null);
      setAviso(original ? `${form.nome.trim()} atualizado.` : `${form.nome.trim()} criado.`);
      setEditando(null);
      carregar();
    });
  }

  // Mudar o preço pede uma confirmação; o resto salva direto.
  function pedirSalvar() {
    if (validacao.erro) return setErro(validacao.erro);
    if (precoMudou) return setConfirmando(true);
    salvar();
  }

  const formulario = (
    <div className="card acao-form">
      <div className="form-produto">
        <label>
          <span className="rotulo-campo">Nome</span>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={80} />
        </label>
        <label>
          <span className="rotulo-campo">Preço (R$)</span>
          <input
            value={form.preco}
            onChange={(e) => setForm({ ...form, preco: e.target.value })}
            inputMode="decimal"
            placeholder="0,00"
          />
        </label>
        <label>
          <span className="rotulo-campo">Setor</span>
          <select value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })}>
            {Object.entries(SETORES).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </label>
        <label>
          <span className="rotulo-campo">Categoria</span>
          <input
            list="categorias-existentes"
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            maxLength={60}
          />
          <datalist id="categorias-existentes">
            {categorias.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="equipe-ativo">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          À venda (desmarque para tirar do cardápio sem apagar)
        </label>
        <label className="equipe-ativo">
          <input
            type="checkbox"
            checked={form.exige_espeto}
            onChange={(e) => setForm({ ...form, exige_espeto: e.target.checked })}
          />
          Pede para escolher o espeto (como a jantinha)
        </label>
      </div>
      {!confirmando ? (
        <div className="linha">
          <button onClick={pedirSalvar} disabled={Boolean(validacao.erro) || ocupado}>Salvar</button>
          <button className="sec" onClick={() => setEditando(null)}>Cancelar</button>
          {validacao.erro && <span className="texto-erro">{validacao.erro}</span>}
        </div>
      ) : (
        <>
          <p>
            <b>Tem certeza?</b> O preço de {form.nome.trim()} vai de {formatarReais(original.preco_centavos)} para{' '}
            {formatarReais(validacao.precoCentavos)}. Pedidos que já foram lançados não mudam.
          </p>
          <div className="linha">
            <button onClick={salvar} disabled={ocupado}>Sim, mudar o preço</button>
            <button className="sec" onClick={() => setConfirmando(false)}>Voltar</button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="linha espaco">
        <h1>Produtos</h1>
        {editando !== 'novo' && <button onClick={() => abrir(null)}>Novo produto</button>}
      </div>
      {erro && <div className="erro" role="alert">{erro}</div>}
      {aviso && <div className="ok">{aviso}</div>}
      {editando === 'novo' && formulario}

      <input
        className="busca-produto"
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar produto ou categoria…"
        aria-label="Buscar produto"
      />
      <div className="chips" role="group" aria-label="Categorias">
        <button className={categoria === null ? 'on' : ''} onClick={() => setCategoria(null)}>Todas</button>
        {categorias.map((c) => (
          <button key={c} className={categoria === c ? 'on' : ''} onClick={() => setCategoria(c)}>{c}</button>
        ))}
      </div>
      <p className="mudo">{visiveis.length} produto(s)</p>

      <ul className="produtos">
        {visiveis.map((p) => (
          <li key={p.id} className={`produto-admin ${p.ativo ? '' : 'inativo'}`}>
            <div className="linha espaco">
              <div className="produto-nome">
                <span>{p.nome}</span>
                <span className="mudo">
                  {formatarReais(p.preco_centavos)} · {SETORES[p.setor]} · {p.categoria}
                  {!p.ativo && <span className="tag cancelado"> Fora do cardápio</span>}
                </span>
              </div>
              {editando !== p.id && <button className="sec" onClick={() => abrir(p)}>Editar</button>}
            </div>
            {editando === p.id && formulario}
          </li>
        ))}
      </ul>

      <details className="tabela-ver">
        <summary>Últimas mudanças do cardápio ({historico.length})</summary>
        {!historico.length && <p className="mudo">Nenhuma mudança registrada ainda.</p>}
        {historico.map((h) => (
          <div key={h.id} className="mudo">
            {new Date(h.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
            <b>{h.produtos?.nome}</b>: {descreverMudanca(h)}
            {h.usuario_nome && <> · {h.usuario_nome}</>}
          </div>
        ))}
      </details>
    </>
  );
}
