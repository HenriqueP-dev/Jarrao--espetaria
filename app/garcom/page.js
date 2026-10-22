'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase, configurado } from '../../lib/supabase';
import { MESAS } from '../../lib/mesas';
import { validarPedido, formatarReais } from '../../lib/conta';
import { adicionarProduto, erroDasLinhas, itensParaEnvio } from '../../lib/pedido';

// Tira acentos e maiúsculas para a busca ("cafe" acha "Café").
const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Garcom() {
  const [produtos, setProdutos] = useState([]);
  const [mesa, setMesa] = useState(null);
  const [pessoa, setPessoa] = useState('');
  const [categoria, setCategoria] = useState(null);
  const [busca, setBusca] = useState('');
  const [linhas, setLinhas] = useState([]); // rascunho do pedido
  const [msg, setMsg] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const contador = useRef(0);

  useEffect(() => {
    supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('ordem')
      .then(({ data, error }) => {
        if (error) setMsg({ tipo: 'erro', texto: error.message });
        else setProdutos(data);
      });
  }, []);

  // Categorias na ordem em que aparecem no cardápio.
  const categorias = useMemo(
    () => [...new Set(produtos.map((p) => p.categoria).filter(Boolean))],
    [produtos]
  );
  const categoriaAtual = categoria ?? categorias[0];

  const espetos = produtos.filter((p) => p.categoria === 'Espetos da casa');

  const visiveis = busca.trim()
    ? produtos.filter((p) => normalizar(p.nome).includes(normalizar(busca.trim())))
    : produtos.filter((p) => p.categoria === categoriaAtual);

  function adicionar(p) {
    contador.current += 1;
    setLinhas((ls) => adicionarProduto(ls, p, contador.current));
  }

  function mudarLinha(chave, campos) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...campos } : l)));
  }

  function mudarQuantidade(chave, delta) {
    setLinhas((ls) =>
      ls
        .map((l) => (l.chave === chave ? { ...l, quantidade: l.quantidade + delta } : l))
        .filter((l) => l.quantidade > 0)
    );
  }

  function remover(chave) {
    setLinhas((ls) => ls.filter((l) => l.chave !== chave));
  }

  const total = linhas.reduce((soma, l) => soma + l.produto.preco_centavos * l.quantidade, 0);

  async function enviar() {
    const itens = itensParaEnvio(linhas, pessoa);
    const erro = validarPedido(mesa, itens) || erroDasLinhas(linhas);
    if (erro) return setMsg({ tipo: 'erro', texto: erro });
    setEnviando(true);
    const { error } = await supabase.rpc('criar_pedido', { p_mesa: mesa, p_itens: itens });
    setEnviando(false);
    if (error) return setMsg({ tipo: 'erro', texto: error.message });
    setMsg({ tipo: 'ok', texto: `Pedido da mesa ${mesa} enviado.` });
    setLinhas([]);
    setPessoa('');
  }

  return (
    <>
      <h1>Garçom</h1>
      <nav><Link href="/">Início</Link><Link href="/mesas">Mesas e contas</Link></nav>
      {!configurado && <div className="aviso">Supabase não configurado (veja o README).</div>}
      {msg && <div className={msg.tipo}>{msg.texto}</div>}

      <h2>1. Mesa</h2>
      <div className="grade">
        {MESAS.map((n) => (
          <button key={n} className={`mesa ${mesa === n ? 'sel' : ''}`} onClick={() => setMesa(n)}>
            {n}
          </button>
        ))}
      </div>

      <h2>2. Pessoa (opcional)</h2>
      <input value={pessoa} onChange={(e) => setPessoa(e.target.value)} placeholder="Ex.: João" />
      <p className="mudo">Deixe vazio se a conta não for separada. Use só o nome.</p>

      <h2>3. Itens</h2>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar produto…"
        style={{ width: '100%', marginBottom: 8 }}
      />
      {!busca.trim() && (
        <div className="abas">
          {categorias.map((c) => (
            <button key={c} className={c === categoriaAtual ? '' : 'sec'} onClick={() => setCategoria(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      {visiveis.map((p) => (
        <div key={p.id} className="card linha espaco">
          <div>
            {p.nome} <span className="mudo">{formatarReais(p.preco_centavos)}</span>
          </div>
          <button onClick={() => adicionar(p)}>+ Adicionar</button>
        </div>
      ))}
      {!visiveis.length && <p className="mudo">Nenhum produto encontrado.</p>}

      <h2>4. Pedido</h2>
      {!linhas.length && <p className="mudo">Nenhum item adicionado.</p>}
      {linhas.map((l) => (
        <div key={l.chave} className="card">
          <div className="linha espaco">
            <strong>{l.produto.nome}</strong>
            {l.produto.exige_espeto ? (
              <button className="sec" onClick={() => remover(l.chave)}>Remover</button>
            ) : (
              <div className="linha">
                <button className="sec" onClick={() => mudarQuantidade(l.chave, -1)}>−</button>
                <strong>{l.quantidade}</strong>
                <button onClick={() => mudarQuantidade(l.chave, 1)}>+</button>
              </div>
            )}
          </div>
          {l.produto.exige_espeto && (
            <select
              value={l.espeto}
              onChange={(e) => mudarLinha(l.chave, { espeto: e.target.value })}
              style={{ marginTop: 8 }}
            >
              <option value="">Escolha o espeto…</option>
              {espetos.map((e) => (
                <option key={e.id} value={e.nome}>{e.nome}</option>
              ))}
            </select>
          )}
          <input
            value={l.obs}
            onChange={(e) => mudarLinha(l.chave, { obs: e.target.value })}
            placeholder="Observação (opcional)"
            style={{ width: '100%', marginTop: 8 }}
          />
        </div>
      ))}
      {linhas.length > 0 && <p><strong>Total: {formatarReais(total)}</strong></p>}

      <button onClick={enviar} disabled={enviando || !linhas.length || mesa === null}>
        {enviando ? 'Enviando…' : `Enviar pedido${mesa ? ` (mesa ${mesa})` : ''}`}
      </button>
    </>
  );
}
