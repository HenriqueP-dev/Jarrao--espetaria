'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, configurado } from '../../lib/supabase';
import { ROTULOS } from '../../lib/estados';
import {
  ABAS,
  agruparPorConta,
  contarPorAba,
  filtrarItens,
  minutosDesde,
  resumoPorProduto,
  urgencia,
} from '../../lib/setor';

// Tela de um setor: mostra só os itens do setor, em tempo real.
// Visual de "alta visibilidade" (direção em direcao_visual/): resumo do que
// falta fazer, abas por estado e um ticket grande por mesa.
// "Entregue" é registrado na tela Mesas (hipótese: quem entrega é o garçom).
export default function TelaSetor({ setor, titulo, unidade = 'itens' }) {
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState('todos');
  const [busca, setBusca] = useState('');
  const [agora, setAgora] = useState(() => Date.now()); // faz os "há X min" andarem

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('itens_pedido')
      .select('*, contas(mesa_numero)')
      .eq('setor', setor)
      .in('estado', ['novo', 'em_preparo', 'pronto'])
      .order('criado_em');
    if (error) return setErro(error.message);
    setErro(null);
    setItens(data);
  }, [setor]);

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel(`setor-${setor}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, carregar)
      .subscribe();
    const tempo = setInterval(carregar, 15000); // reserva caso o tempo real falhe
    const relogio = setInterval(() => setAgora(Date.now()), 30000);
    return () => {
      clearInterval(tempo);
      clearInterval(relogio);
      supabase.removeChannel(canal);
    };
  }, [setor, carregar]);

  async function mudar(id, novo) {
    const { error } = await supabase.rpc('mudar_estado_item', { p_item: id, p_novo: novo });
    if (error) setErro(error.message);
    else carregar();
  }

  const contagem = useMemo(() => contarPorAba(itens), [itens]);
  const resumo = useMemo(() => resumoPorProduto(itens), [itens]);
  const tickets = useMemo(
    () => agruparPorConta(filtrarItens(itens, aba, busca)),
    [itens, aba, busca]
  );
  const faltaFazer = contagem.novo + contagem.em_preparo;

  return (
    <>
      <div className="linha espaco">
        <h1>{titulo}</h1>
        <span className="contador-topo" aria-live="polite">
          {faltaFazer} {unidade} p/ fazer
        </span>
      </div>
      {!configurado && <div className="aviso">Supabase não configurado (veja o README).</div>}
      {erro && <div className="erro">{erro}</div>}

      <section className="painel" aria-label="Resumo em tempo real">
        <div className="painel-titulo">Resumo em tempo real</div>
        {resumo.length ? (
          <div className="resumo">
            {resumo.map((r) => (
              <div key={r.nome} className="resumo-item">
                <span>{r.nome}</span>
                <b>{r.quantidade}x</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="mudo">Nada na fila agora.</p>
        )}
      </section>

      <input
        className="busca"
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar mesa, produto ou observação…"
        aria-label="Buscar"
      />

      <div className="abas-grandes" role="tablist">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            className={aba === a.id ? 'on' : ''}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo} <span className="num">{contagem[a.id]}</span>
          </button>
        ))}
      </div>

      {!tickets.length && (
        <p className="mudo">{busca.trim() ? 'Nada encontrado para essa busca.' : 'Nenhum item aqui.'}</p>
      )}

      {tickets.map((t) => {
        const min = minutosDesde(t.maisAntigo, agora);
        const tudoPronto = t.itens.every((i) => i.estado === 'pronto');
        return (
          <article key={t.conta_id} className={`ticket ${tudoPronto ? 'pronto' : urgencia(min)}`}>
            <header className="ticket-topo">
              <div>
                <h3 className="ticket-mesa">Mesa {t.mesa}</h3>
                <span className="mudo">
                  {t.itens.length} {t.itens.length === 1 ? 'linha' : 'linhas'}
                </span>
              </div>
              <div className="ticket-tempo">
                <b>{min} min</b>
                <span className="mudo">
                  desde {new Date(t.maisAntigo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </header>

            {t.itens.map((i) => (
              <div key={i.id} className={`ticket-item ${i.estado}`}>
                <div className="linha espaco">
                  <div className="ticket-nome">
                    <b>{i.quantidade}x</b> {i.nome_produto}
                    {i.pessoa && <span className="mudo"> · {i.pessoa}</span>}
                  </div>
                  <span className={`tag ${i.estado}`}>{ROTULOS[i.estado]}</span>
                </div>
                {i.detalhe && <div className="obs">{i.detalhe}</div>}
                <div className="ticket-acoes">
                  {i.estado === 'novo' && (
                    <button className="sec" onClick={() => mudar(i.id, 'em_preparo')}>
                      Em preparo
                    </button>
                  )}
                  {(i.estado === 'novo' || i.estado === 'em_preparo') && (
                    <button onClick={() => mudar(i.id, 'pronto')}>Pronto ✓</button>
                  )}
                  {i.estado === 'pronto' && <span className="mudo">Aguardando o garçom retirar</span>}
                </div>
              </div>
            ))}
          </article>
        );
      })}
    </>
  );
}
