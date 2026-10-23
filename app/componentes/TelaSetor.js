'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, configurado } from '../../lib/supabase';
import { ROTULOS } from '../../lib/estados';
import {
  ABAS,
  agruparFichas,
  contarPorAba,
  faseDaFicha,
  itensParaAvancar,
  minutosDesde,
  urgencia,
} from '../../lib/setor';

// Tela de um setor: mostra só os itens do setor, em tempo real.
// Visual pensado para churrasqueira e cozinha (direção em direcao_visual/):
// abas por estado e uma ficha por mesa com um único botão grande.
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

  // Muda todos os itens da ficha que ainda podem mudar (um por vez no banco).
  async function avancarFicha(ficha, destino) {
    const alvos = itensParaAvancar(ficha.itens, destino);
    const respostas = await Promise.all(
      alvos.map((i) => supabase.rpc('mudar_estado_item', { p_item: i.id, p_novo: destino }))
    );
    const falha = respostas.find((r) => r.error);
    setErro(falha ? falha.error.message : null);
    carregar();
  }

  const contagem = useMemo(() => contarPorAba(itens), [itens]);
  const tickets = useMemo(() => agruparFichas(itens, aba, busca), [itens, aba, busca]);
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
        const fase = faseDaFicha(t.itens);
        return (
          <article key={t.conta_id} className={`ticket ${fase === 'pronto' ? 'pronto' : urgencia(min)}`}>
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
              <label key={i.id} className={`ticket-item ${i.estado}`}>
                <input
                  type="checkbox"
                  className="marcar"
                  checked={i.estado === 'pronto'}
                  disabled={i.estado === 'pronto'}
                  onChange={() => mudar(i.id, 'pronto')}
                  aria-label={`Marcar ${i.nome_produto} como pronto`}
                />
                <div className="ticket-corpo">
                  <div className="linha espaco">
                    <div className="ticket-nome">
                      <b>{i.quantidade}x</b> {i.nome_produto}
                      {i.pessoa && <span className="mudo"> · {i.pessoa}</span>}
                    </div>
                    <span className={`tag ${i.estado}`}>{ROTULOS[i.estado]}</span>
                  </div>
                  {i.detalhe && <div className="obs">{i.detalhe}</div>}
                </div>
              </label>
            ))}

            {/* Um único botão grande, que muda conforme a fase. O estado continua sendo de cada item. */}
            <div className="ticket-acoes">
              {fase === 'novo' && (
                <button onClick={() => avancarFicha(t, 'em_preparo')}>Iniciar preparo</button>
              )}
              {fase === 'em_preparo' && (
                <button onClick={() => avancarFicha(t, 'pronto')}>Pronto ✓</button>
              )}
              {fase === 'pronto' && <span className="mudo">Pronto. Aguardando o garçom retirar.</span>}
            </div>
          </article>
        );
      })}
    </>
  );
}
