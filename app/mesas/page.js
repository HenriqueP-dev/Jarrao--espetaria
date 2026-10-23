'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, configurado } from '../../lib/supabase';
import { ROTULOS, itensEntregaveis } from '../../lib/estados';
import { totalConta, formatarReais } from '../../lib/conta';
import { agruparPorSetor } from '../../lib/setor';

export default function Mesas() {
  const [abertas, setAbertas] = useState({}); // mesa -> conta
  const [todosItens, setTodosItens] = useState([]); // itens de todas as contas abertas
  const [mesa, setMesa] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('contas').select('*').eq('status', 'aberta');
    if (error) return setErro(error.message);
    const porMesa = {};
    data.forEach((c) => (porMesa[c.mesa_numero] = c));

    const ids = data.map((c) => c.id);
    const conta = mesa && porMesa[mesa];
    const [it, hi] = await Promise.all([
      ids.length
        ? supabase.from('itens_pedido').select('*').in('conta_id', ids).order('criado_em')
        : { data: [] },
      conta
        ? supabase.from('historico').select('*').eq('conta_id', conta.id).order('criado_em')
        : { data: [] },
    ]);
    if (it.error || hi.error) return setErro((it.error || hi.error).message);
    setErro(null);
    setAbertas(porMesa);
    setTodosItens(it.data);
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

  // Resumo de cada mesa com conta aberta: total registrado e itens esperando o garçom.
  const resumo = useMemo(() => {
    const r = {};
    for (const c of Object.values(abertas)) {
      const itens = todosItens.filter((i) => i.conta_id === c.id);
      r[c.mesa_numero] = {
        total: totalConta(itens),
        prontos: itens.filter((i) => i.estado === 'pronto').length,
        emAndamento: itens.filter((i) => i.estado === 'novo' || i.estado === 'em_preparo').length,
      };
    }
    return r;
  }, [abertas, todosItens]);

  // Só existem as mesas com conta aberta; o número é livre (mesas emprestadas do vizinho).
  const mesasAbertas = Object.keys(abertas).map(Number).sort((x, y) => x - y);
  const qtdAbertas = mesasAbertas.length;
  const qtdProntos = Object.values(resumo).reduce((s, r) => s + r.prontos, 0);
  const qtdAndamento = Object.values(resumo).reduce((s, r) => s + r.emAndamento, 0);

  const itens = abertas[mesa] ? todosItens.filter((i) => i.conta_id === abertas[mesa].id) : [];
  const grupos = agruparPorSetor(itens);

  // Cada grupo (bebidas, espetos, cozinha) tem o seu botão: entrega o que já
  // está pronto naquele grupo (e as bebidas, que não passam por preparo).
  async function entregar(grupo) {
    const respostas = await Promise.all(
      itensEntregaveis(grupo.itens).map((i) =>
        supabase.rpc('mudar_estado_item', { p_item: i.id, p_novo: 'entregue' })
      )
    );
    const falha = respostas.find((r) => r.error);
    setErro(falha ? falha.error.message : null);
    carregar();
  }

  return (
    <>
      <h1>Mesas e contas</h1>
      {!configurado && <div className="aviso">Supabase não configurado (veja o README).</div>}
      {erro && <div className="erro">{erro}</div>}

      <div className="kpis">
        <div className="kpi">
          <span className="mudo">Contas abertas</span>
          <b>{qtdAbertas}</b>
        </div>
        <div className="kpi">
          <span className="mudo">Em preparo</span>
          <b>{qtdAndamento}</b>
        </div>
        <div className={`kpi ${qtdProntos ? 'destaque' : ''}`}>
          <span className="mudo">Prontos p/ entregar</span>
          <b>{qtdProntos}</b>
        </div>
      </div>

      {!qtdAbertas && <p className="mudo">Nenhuma conta aberta. As mesas aparecem aqui quando o primeiro pedido é lançado.</p>}
      <div className="grade-mesas">
        {mesasAbertas.map((n) => {
          const r = resumo[n];
          return (
            <button
              key={n}
              className={`mesa-card aberta ${r.prontos ? 'tem-pronto' : ''} ${mesa === n ? 'sel' : ''}`}
              aria-pressed={mesa === n}
              onClick={() => setMesa(n)}
            >
              <span className="mesa-num">{n}</span>
              <span className="mesa-valor">{formatarReais(r.total)}</span>
              {r.prontos > 0 && <span className="mesa-aviso">{r.prontos} pronto(s)</span>}
            </button>
          );
        })}
      </div>

      {mesa && (
        <>
          <h2>Mesa {mesa}</h2>
          {!abertas[mesa] && <p className="mudo">Sem conta aberta.</p>}
          {grupos.length > 0 && (
            <div className="entregas" role="group" aria-label="Entregar">
              {grupos.map((g) => {
                const qtd = itensEntregaveis(g.itens).reduce((soma, i) => soma + i.quantidade, 0);
                return (
                  <button key={g.id} className="entregar" onClick={() => entregar(g)} disabled={!qtd}>
                    <small>Entregue</small>
                    <b>{g.rotulo}</b>
                    <span className="n">{qtd}</span>
                  </button>
                );
              })}
            </div>
          )}
          {grupos.map((g) => (
            <section key={g.id} className="grupo">
              <h3 className="grupo-titulo">{g.rotulo}</h3>
              {g.itens.map((i) => (
                <div key={i.id} className={`card linha espaco ${i.estado === 'pronto' ? 'card-pronto' : ''}`}>
                  <div>
                    {i.quantidade}x {i.nome_produto}
                    {i.pessoa && <> ({i.pessoa})</>}
                    {i.detalhe && <span className="mudo"> · {i.detalhe}</span>} — {formatarReais(i.preco_centavos * i.quantidade)}{' '}
                    <span className={`tag ${i.estado}`}>{ROTULOS[i.estado]}</span>
                  </div>
                  {['novo', 'em_preparo', 'pronto'].includes(i.estado) && (
                    <button className="perigo" onClick={() => mudar(i.id, 'cancelado')}>Cancelar</button>
                  )}
                </div>
              ))}
            </section>
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
