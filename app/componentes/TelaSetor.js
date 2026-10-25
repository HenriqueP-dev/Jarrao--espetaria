'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, configurado } from '../../lib/supabase';
import { mensagemDeErro } from '../../lib/erros';
import { useTrava } from './useTrava';
import { useTempoReal } from './useTempoReal';
import { ROTULOS } from '../../lib/estados';
import {
  COLUNAS,
  faltaFazer,
  faseDaFicha,
  fichasPorColuna,
  itensParaAvancar,
  minutosDesde,
  separarCancelados,
  urgencia,
} from '../../lib/setor';

// Tela de um setor: mostra só os itens do setor, em tempo real.
// Visual pensado para churrasqueira e cozinha (direção em direcao_visual/):
// colunas Kanban e uma ficha por mesa com um único botão grande.
// "Entregue" é registrado na tela Mesas (hipótese: quem entrega é o garçom).
// Cancelamentos aparecem num quadro vermelho no topo até alguém tocar em "Ciente"
// (hipótese: ver docs/DECISOES.md).
export default function TelaSetor({ setor, titulo, unidade = 'itens' }) {
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [agora, setAgora] = useState(() => Date.now()); // faz os "há X min" andarem

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('itens_pedido')
      .select('*, contas(mesa_numero)')
      .eq('setor', setor)
      .or('estado.in.(novo,em_preparo,pronto),and(estado.eq.cancelado,cancelamento_visto_em.is.null)')
      .order('criado_em');
    if (error) return setErro(mensagemDeErro(error));
    setErro(null);
    setItens(data);
  }, [setor]);

  // Tempo real + reserva de 20 s (só com a tela visível).
  useTempoReal({ nome: `setor-${setor}`, tabelas: ['itens_pedido', 'contas'], carregar, intervalo: 20000 });

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(relogio);
  }, []);

  // Cada ação roda uma vez por vez: toque duplo não repete a chamada.
  const { ocupado, travar } = useTrava();

  function mudar(id, novo) {
    return travar(async () => {
      const { error } = await supabase.rpc('mudar_estado_item', { p_item: id, p_novo: novo });
      if (error) setErro(mensagemDeErro(error));
      else carregar();
    });
  }

  // Muda todos os itens da ficha que ainda podem mudar, tudo ou nada (uma só chamada).
  function avancarFicha(ficha, destino) {
    return travar(async () => {
      const ids = itensParaAvancar(ficha.itens, destino).map((i) => i.id);
      if (!ids.length) return;
      const { error } = await supabase.rpc('mudar_estado_itens', { p_itens: ids, p_novo: destino });
      setErro(mensagemDeErro(error));
      carregar();
    });
  }

  function darCiente(id) {
    return travar(async () => {
      const { error } = await supabase.rpc('confirmar_cancelamento', { p_item: id });
      setErro(mensagemDeErro(error));
      carregar();
    });
  }

  const { ativos, cancelados } = useMemo(() => separarCancelados(itens), [itens]);
  const colunas = useMemo(() => fichasPorColuna(ativos, busca), [ativos, busca]);

  return (
    <>
      <div className="linha espaco">
        <h1>{titulo}</h1>
        <span className="contador-topo" aria-live="polite">
          {faltaFazer(ativos)} {unidade} p/ fazer
        </span>
      </div>
      {!configurado && <div className="aviso">Supabase não configurado (veja o README).</div>}
      {erro && <div className="erro">{erro}</div>}

      {/* Cancelados que o setor ainda não viu: ninguém deve preparar isto. */}
      {cancelados.length > 0 && (
        <section className="quadro-cancelado" role="alert" aria-label="Itens cancelados">
          <h2>Cancelado: não preparar</h2>
          {cancelados.map((i) => (
            <div key={i.id} className="cancelado-linha">
              <div>
                <b>Mesa {i.contas?.mesa_numero}</b> · {i.quantidade}x {i.nome_produto}
                {i.detalhe && <span> ({i.detalhe})</span>}
                {i.pessoa && <span className="mudo"> · {i.pessoa}</span>}
              </div>
              <button className="perigo" onClick={() => darCiente(i.id)} disabled={ocupado}>Ciente</button>
            </div>
          ))}
        </section>
      )}

      <input
        className="busca"
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar mesa, produto ou observação…"
        aria-label="Buscar"
      />

      {/* Quadro Kanban: as três colunas ficam à vista ao mesmo tempo. */}
      <div className="kanban">
        {COLUNAS.map((col) => {
          const fichas = colunas[col.id];
          return (
            <section key={col.id} className={`coluna ${col.id}`} aria-label={col.rotulo}>
              <h2 className="coluna-titulo">
                {col.rotulo} <span className="num">{fichas.length}</span>
              </h2>
              {!fichas.length && (
                <p className="mudo coluna-vazia">{busca.trim() ? 'Nada encontrado.' : 'Nenhuma mesa aqui.'}</p>
              )}
              {fichas.map((t) => {
                const min = minutosDesde(t.maisAntigo, agora);
                const fase = faseDaFicha(t.itens);
                return (
                  <article key={t.conta_id} className={`ticket ${fase === 'pronto' ? 'pronto' : urgencia(min)}`}>
                    <header className="ticket-topo">
                      <h3 className="ticket-mesa">Mesa {t.mesa}</h3>
                      <div className="ticket-tempo">
                        <span className="mudo">
                          {new Date(t.maisAntigo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <b>{min} min</b>
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
                        <button onClick={() => avancarFicha(t, 'em_preparo')} disabled={ocupado}>Iniciar preparo</button>
                      )}
                      {fase === 'em_preparo' && (
                        <button onClick={() => avancarFicha(t, 'pronto')} disabled={ocupado}>Pronto ✓</button>
                      )}
                      {fase === 'pronto' && <span className="mudo">Pronto. Aguardando o garçom retirar.</span>}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
