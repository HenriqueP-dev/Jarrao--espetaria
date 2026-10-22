'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configurado } from '../../lib/supabase';
import { MESAS } from '../../lib/mesas';
import { ROTULOS, podeMudar } from '../../lib/estados';
import { totalConta, formatarReais } from '../../lib/conta';

export default function Mesas() {
  const [abertas, setAbertas] = useState({}); // mesa -> conta
  const [mesa, setMesa] = useState(null);
  const [itens, setItens] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('contas').select('*').eq('status', 'aberta');
    if (error) return setErro(error.message);
    const porMesa = {};
    data.forEach((c) => (porMesa[c.mesa_numero] = c));
    setAbertas(porMesa);

    const conta = mesa && porMesa[mesa];
    if (!conta) {
      setItens([]);
      setHistorico([]);
      return;
    }
    const [it, hi] = await Promise.all([
      supabase.from('itens_pedido').select('*').eq('conta_id', conta.id).order('criado_em'),
      supabase.from('historico').select('*').eq('conta_id', conta.id).order('criado_em'),
    ]);
    if (it.error || hi.error) return setErro((it.error || hi.error).message);
    setErro(null);
    setItens(it.data);
    setHistorico(hi.data);
  }, [mesa]);

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel('mesas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, carregar)
      .subscribe();
    const tempo = setInterval(carregar, 15000);
    return () => {
      clearInterval(tempo);
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  async function mudar(id, novo) {
    const { error } = await supabase.rpc('mudar_estado_item', { p_item: id, p_novo: novo });
    if (error) setErro(error.message);
    else carregar();
  }

  return (
    <>
      <h1>Mesas e contas</h1>
      <nav><Link href="/">Início</Link><Link href="/garcom">Garçom</Link></nav>
      {!configurado && <div className="aviso">Supabase não configurado (veja o README).</div>}
      {erro && <div className="erro">{erro}</div>}

      <div className="grade">
        {MESAS.map((n) => (
          <button
            key={n}
            className={`mesa ${abertas[n] ? 'aberta' : ''} ${mesa === n ? 'sel' : ''}`}
            onClick={() => setMesa(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mudo">Mesas destacadas têm conta aberta.</p>

      {mesa && (
        <>
          <h2>Mesa {mesa}</h2>
          {!abertas[mesa] && <p className="mudo">Sem conta aberta.</p>}
          {itens.map((i) => (
            <div key={i.id} className="card linha espaco">
              <div>
                {i.quantidade}x {i.nome_produto}
                {i.pessoa && <> ({i.pessoa})</>}
                {i.detalhe && <span className="mudo"> · {i.detalhe}</span>} — {formatarReais(i.preco_centavos * i.quantidade)}{' '}
                <span className={`tag ${i.estado}`}>{ROTULOS[i.estado]}</span>
              </div>
              <div className="linha">
                {podeMudar(i.estado, 'entregue', i.setor) && (
                  <button onClick={() => mudar(i.id, 'entregue')}>Entregue</button>
                )}
                {['novo', 'em_preparo', 'pronto'].includes(i.estado) && (
                  <button className="perigo" onClick={() => mudar(i.id, 'cancelado')}>Cancelar</button>
                )}
              </div>
            </div>
          ))}
          {abertas[mesa] && (
            <p><strong>Total registrado: {formatarReais(totalConta(itens))}</strong></p>
          )}

          {historico.length > 0 && (
            <details>
              <summary>Histórico da conta</summary>
              {historico.map((h) => (
                <div key={h.id} className="mudo">
                  {new Date(h.criado_em).toLocaleTimeString('pt-BR')} — {h.evento}
                  {h.detalhe && `: ${h.detalhe}`}
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </>
  );
}
