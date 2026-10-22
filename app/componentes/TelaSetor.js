'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configurado } from '../../lib/supabase';
import { ROTULOS } from '../../lib/estados';

// Tela de um setor: mostra só os itens do setor, em tempo real.
// "Entregue" é registrado na tela Mesas (hipótese: quem entrega é o garçom).
export default function TelaSetor({ setor, titulo }) {
  const [itens, setItens] = useState([]);
  const [contas, setContas] = useState({}); // conta_id -> mesa
  const [erro, setErro] = useState(null);

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
    return () => {
      clearInterval(tempo);
      supabase.removeChannel(canal);
    };
  }, [setor, carregar]);

  async function mudar(id, novo) {
    const { error } = await supabase.rpc('mudar_estado_item', { p_item: id, p_novo: novo });
    if (error) setErro(error.message);
    else carregar();
  }

  return (
    <>
      <h1>{titulo}</h1>
      <nav><Link href="/">Início</Link></nav>
      {!configurado && <div className="aviso">Supabase não configurado (veja o README).</div>}
      {erro && <div className="erro">{erro}</div>}
      {!itens.length && <p className="mudo">Nenhum item pendente.</p>}
      {itens.map((i) => (
        <div key={i.id} className="card linha espaco">
          <div>
            <strong>Mesa {i.contas?.mesa_numero}</strong>
            {i.pessoa && <> / {i.pessoa}</>} — {i.quantidade}x {i.nome_produto}{i.detalhe && <strong> ({i.detalhe})</strong>}{' '}
            <span className={`tag ${i.estado}`}>{ROTULOS[i.estado]}</span>
          </div>
          <div className="linha">
            {i.estado === 'novo' && <button onClick={() => mudar(i.id, 'em_preparo')}>Em preparo</button>}
            {(i.estado === 'novo' || i.estado === 'em_preparo') && (
              <button onClick={() => mudar(i.id, 'pronto')}>Pronto</button>
            )}
            {i.estado === 'pronto' && <span className="mudo">aguardando garçom</span>}
          </div>
        </div>
      ))}
    </>
  );
}
