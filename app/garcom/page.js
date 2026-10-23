'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, configurado } from '../../lib/supabase';
import { lerMesaPessoa } from '../../lib/mesas';
import { validarPedido, formatarReais } from '../../lib/conta';
import { adicionarProduto, erroDasLinhas, itensParaEnvio } from '../../lib/pedido';
import { normalizar } from '../../lib/setor';

// Tela do garçom. O cardápio (esquerda) e o pedido do cliente (painel à direita,
// ou folha que sobe no celular) ficam separados de propósito: assim nunca se
// confunde o que o cliente pediu com os resultados de uma busca.
export default function Garcom() {
  const [produtos, setProdutos] = useState([]);
  const [destino, setDestino] = useState(''); // campo único: "12" ou "12/João"
  const [categoria, setCategoria] = useState(null);
  const [busca, setBusca] = useState('');
  const [linhas, setLinhas] = useState([]); // rascunho do pedido
  const [obsAbertas, setObsAbertas] = useState([]); // chaves das linhas com observação aberta
  const [painelAberto, setPainelAberto] = useState(false); // folha do pedido (celular)
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

  const termo = busca.trim();
  const visiveis = termo
    ? produtos.filter((p) => normalizar(p.nome).includes(normalizar(termo)))
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

  function alternarObs(chave) {
    setObsAbertas((a) => (a.includes(chave) ? a.filter((c) => c !== chave) : [...a, chave]));
  }

  const total = linhas.reduce((soma, l) => soma + l.produto.preco_centavos * l.quantidade, 0);
  const qtdItens = linhas.reduce((soma, l) => soma + l.quantidade, 0);
  // Quantas unidades de cada produto já estão no pedido (selo na lista do cardápio).
  const noPedido = (id) => linhas.filter((l) => l.produto.id === id).reduce((s, l) => s + l.quantidade, 0);

  // O campo único vira mesa + pessoa. Enquanto estiver inválido, o envio fica bloqueado.
  const lido = lerMesaPessoa(destino);
  const mesa = lido.erro ? null : lido.mesa;
  const pessoa = lido.erro ? '' : lido.pessoa ?? '';
  const rotuloMesa = mesa ? `Mesa ${mesa}${pessoa ? ` / ${pessoa}` : ''}` : 'Sem mesa';

  async function enviar() {
    if (lido.erro) return setMsg({ tipo: 'erro', texto: lido.erro });
    const itens = itensParaEnvio(linhas, pessoa);
    const erro = validarPedido(mesa, itens) || erroDasLinhas(linhas);
    if (erro) return setMsg({ tipo: 'erro', texto: erro });
    setEnviando(true);
    const { error } = await supabase.rpc('criar_pedido', { p_mesa: mesa, p_itens: itens });
    setEnviando(false);
    if (error) return setMsg({ tipo: 'erro', texto: error.message });
    setMsg({ tipo: 'ok', texto: `Pedido da mesa ${mesa}${pessoa ? ` (${pessoa})` : ''} enviado.` });
    setLinhas([]);
    setObsAbertas([]);
    setPainelAberto(false);
  }

  const podeEnviar = !enviando && linhas.length > 0 && mesa !== null;

  return (
    <>
      <h1>Garçom</h1>
      {!configurado && <div className="aviso">Supabase não configurado (veja o README).</div>}
      {msg && <div className={msg.tipo}>{msg.texto}</div>}

      <label className="rotulo-campo" htmlFor="destino">Mesa / pessoa</label>
      <input
        id="destino"
        className="campo-mesa"
        value={destino}
        onChange={(e) => setDestino(e.target.value)}
        placeholder="12  ou  12/João"
        autoComplete="off"
        aria-invalid={destino.trim() !== '' && Boolean(lido.erro)}
      />
      {destino.trim() !== '' && lido.erro && <p className="texto-erro">{lido.erro}</p>}

      <div className="garcom-layout">
        <section className="cardapio" aria-label="Cardápio">
          <input
            className="busca-produto"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no cardápio…"
            aria-label="Buscar no cardápio"
          />
          {termo ? (
            <p className="resultados">
              {visiveis.length} resultado(s) para “{termo}” <span className="mudo">· não são itens do pedido</span>
            </p>
          ) : (
            <div className="chips" role="tablist" aria-label="Categorias">
              {categorias.map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={c === categoriaAtual}
                  className={c === categoriaAtual ? 'on' : ''}
                  onClick={() => setCategoria(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <ul className="produtos">
            {visiveis.map((p) => {
              const n = noPedido(p.id);
              return (
                <li key={p.id} className={`produto ${n ? 'tem' : ''}`}>
                  <div className="produto-nome">
                    <span>{p.nome}</span>
                    <span className="mudo">
                      {formatarReais(p.preco_centavos)}
                      {n > 0 && <b className="no-pedido"> · {n} no pedido</b>}
                    </span>
                  </div>
                  <button className="mais" onClick={() => adicionar(p)} aria-label={`Adicionar ${p.nome}`}>
                    +
                  </button>
                </li>
              );
            })}
          </ul>
          {!visiveis.length && termo && <p className="mudo">Nenhum produto encontrado.</p>}
        </section>

        <aside className={`pedido-painel ${painelAberto ? 'aberto' : ''}`} aria-label="Pedido">
          <header className="pedido-topo">
            <div>
              <h2>Pedido</h2>
              <span className="mudo">{rotuloMesa}</span>
            </div>
            <button className="sec fechar-painel" onClick={() => setPainelAberto(false)}>
              Fechar
            </button>
          </header>

          {!linhas.length && <p className="mudo vazio">Toque em + nos produtos para montar o pedido.</p>}

          {linhas.map((l) => (
            <div key={l.chave} className="linha-pedido">
              <div className="lp-topo">
                <b>{l.produto.nome}</b>
                <span>{formatarReais(l.produto.preco_centavos * l.quantidade)}</span>
              </div>

              {l.produto.exige_espeto && (
                <select
                  value={l.espeto}
                  onChange={(e) => mudarLinha(l.chave, { espeto: e.target.value })}
                  aria-label="Espeto da jantinha"
                >
                  <option value="">Escolha o espeto…</option>
                  {espetos.map((e) => (
                    <option key={e.id} value={e.nome}>{e.nome}</option>
                  ))}
                </select>
              )}

              {(obsAbertas.includes(l.chave) || l.obs) && (
                <input
                  value={l.obs}
                  onChange={(e) => mudarLinha(l.chave, { obs: e.target.value })}
                  placeholder="Observação"
                  aria-label="Observação"
                />
              )}

              <div className="lp-controles">
                {l.produto.exige_espeto ? (
                  <button className="sec" onClick={() => remover(l.chave)}>Remover</button>
                ) : (
                  <div className="stepper">
                    <button className="sec" onClick={() => mudarQuantidade(l.chave, -1)} aria-label="Menos um">−</button>
                    <b>{l.quantidade}</b>
                    <button className="sec" onClick={() => mudarQuantidade(l.chave, 1)} aria-label="Mais um">+</button>
                  </div>
                )}
                {!(obsAbertas.includes(l.chave) || l.obs) && (
                  <button className="sec leve" onClick={() => alternarObs(l.chave)}>+ observação</button>
                )}
              </div>
            </div>
          ))}

          {linhas.length > 0 && (
            <div className="pedido-total">
              <span>Total</span>
              <b>{formatarReais(total)}</b>
            </div>
          )}
          <button className="enviar-painel grande" onClick={enviar} disabled={!podeEnviar}>
            {enviando ? 'Enviando…' : 'Enviar pedido'}
          </button>
        </aside>
      </div>

      {painelAberto && <div className="fundo-painel" onClick={() => setPainelAberto(false)} />}

      {/* Barra fixa (celular): resumo que abre o pedido + botão de enviar sempre à mão. */}
      <div className="barra-fixa">
        <div className="barra-fixa-conteudo">
          <button className="sec barra-resumo" onClick={() => setPainelAberto(true)} disabled={!linhas.length}>
            <span className="mudo">{rotuloMesa}</span>
            <b>
              {qtdItens} {qtdItens === 1 ? 'item' : 'itens'} · {formatarReais(total)}
            </b>
          </button>
          <button onClick={enviar} disabled={!podeEnviar}>
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </>
  );
}
