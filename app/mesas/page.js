'use client';

import { useCallback, useMemo, useState } from 'react';
import { supabase, configurado } from '../../lib/supabase';
import { mensagemDeErro } from '../../lib/erros';
import { ROTULOS, itensEntregaveis } from '../../lib/estados';
import { totalConta, formatarReais } from '../../lib/conta';
import { agruparPorSetor } from '../../lib/setor';
import { mesaValida } from '../../lib/mesas';
import { useTrava } from '../componentes/useTrava';
import { useTempoReal } from '../componentes/useTempoReal';

export default function Mesas() {
  const [abertas, setAbertas] = useState({}); // mesa -> conta
  const [todosItens, setTodosItens] = useState([]); // itens de todas as contas abertas
  const [mesa, setMesa] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  // Troca de mesa e mover item: sempre em dois passos (preencher, depois confirmar).
  const [troca, setTroca] = useState(null); // { valor, confirmando }
  const [mover, setMover] = useState(null); // { id, valor, confirmando }
  const { ocupado, travar } = useTrava(); // evita o mesmo toque rodar duas vezes

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('contas').select('*').eq('status', 'aberta');
    if (error) return setErro(mensagemDeErro(error));
    const porMesa = {};
    data.forEach((c) => (porMesa[c.mesa_numero] = c));

    const ids = data.map((c) => c.id);
    const conta = mesa && porMesa[mesa];
    const [it, hi] = await Promise.all([
      ids.length
        ? supabase.from('itens_pedido').select('*').in('conta_id', ids).order('criado_em')
        : { data: [] },
      conta
        ? supabase.from('historico').select('*').eq('conta_id', conta.id).order('criado_em').order('id')
        : { data: [] },
    ]);
    if (it.error || hi.error) return setErro(mensagemDeErro(it.error || hi.error));
    setErro(null);
    setAbertas(porMesa);
    setTodosItens(it.data);
    setHistorico(hi.data);
  }, [mesa]);

  useTempoReal({ nome: 'mesas', tabelas: ['itens_pedido', 'contas'], carregar });

  function escolherMesa(n) {
    setMesa(n);
    setTroca(null);
    setMover(null);
    setAviso(null);
  }

  function mudar(id, novo) {
    return travar(async () => {
      const { error } = await supabase.rpc('mudar_estado_item', { p_item: id, p_novo: novo });
      if (error) setErro(mensagemDeErro(error));
      else carregar();
    });
  }

  // Resumo de cada mesa com conta aberta: total registrado e o que o garçom já pode entregar.
  const resumo = useMemo(() => {
    const r = {};
    for (const c of Object.values(abertas)) {
      const itens = todosItens.filter((i) => i.conta_id === c.id);
      r[c.mesa_numero] = {
        total: totalConta(itens),
        paraEntregar: itensEntregaveis(itens).length,
        // O que a cozinha e a churrasqueira ainda estão fazendo (bebidas não entram).
        emAndamento: itens.filter(
          (i) => (i.estado === 'novo' || i.estado === 'em_preparo') && i.setor !== 'garcom'
        ).length,
      };
    }
    return r;
  }, [abertas, todosItens]);

  // Só existem as mesas com conta aberta; o número é livre (mesas emprestadas do vizinho).
  const mesasAbertas = Object.keys(abertas).map(Number).sort((x, y) => x - y);
  const qtdAbertas = mesasAbertas.length;
  const qtdParaEntregar = Object.values(resumo).reduce((s, r) => s + r.paraEntregar, 0);
  const qtdAndamento = Object.values(resumo).reduce((s, r) => s + r.emAndamento, 0);

  const conta = abertas[mesa];
  const itens = conta ? todosItens.filter((i) => i.conta_id === conta.id) : [];
  const grupos = agruparPorSetor(itens);

  // Cada grupo (bebidas, espetos, cozinha) tem o seu botão: entrega o que já
  // está pronto naquele grupo (e as bebidas, que não passam por preparo).
  // Uma só chamada: ou entrega tudo, ou não muda nada.
  function entregar(grupo) {
    return travar(async () => {
      const ids = itensEntregaveis(grupo.itens).map((i) => i.id);
      if (!ids.length) return;
      const { error } = await supabase.rpc('mudar_estado_itens', { p_itens: ids, p_novo: 'entregue' });
      setErro(mensagemDeErro(error));
      carregar();
    });
  }

  // --- Trocar a conta de mesa -------------------------------------------------
  const mesaNova = troca ? Number(troca.valor) : NaN;
  const mesaNovaOk = mesaValida(mesaNova) && mesaNova !== mesa;

  function confirmarTroca() {
    return travar(async () => {
      const { error } = await supabase.rpc('trocar_mesa', { p_conta: conta.id, p_mesa: mesaNova });
      if (error) {
        setErro(mensagemDeErro(error));
        setTroca({ ...troca, confirmando: false });
        return;
      }
      setErro(null);
      setAviso(`Conta passada da mesa ${mesa} para a mesa ${mesaNova}.`);
      setTroca(null);
      setMesa(mesaNova);
    });
  }

  // --- Mover um item para outra pessoa ----------------------------------------
  const itemMover = mover ? itens.find((i) => i.id === mover.id) : null;
  const pessoaNova = mover ? mover.valor.trim() : '';
  const nomeLongo = pessoaNova.length > 60;
  const nomeIgual = itemMover ? (itemMover.pessoa ?? '') === pessoaNova : false;

  function confirmarMover() {
    return travar(async () => {
      const { error } = await supabase.rpc('mudar_pessoa_item', {
        p_item: mover.id,
        p_pessoa: pessoaNova,
      });
      if (error) {
        setErro(mensagemDeErro(error));
        setMover({ ...mover, confirmando: false });
        return;
      }
      setErro(null);
      setAviso('Item movido.');
      setMover(null);
      carregar();
    });
  }

  return (
    <>
      <h1>Mesas e contas</h1>
      {!configurado && <div className="aviso">Supabase não configurado (veja o README).</div>}
      {erro && <div className="erro">{erro}</div>}
      {aviso && <div className="ok">{aviso}</div>}

      <div className="kpis">
        <div className="kpi">
          <span className="mudo">Contas abertas</span>
          <b>{qtdAbertas}</b>
        </div>
        <div className="kpi">
          <span className="mudo">Em andamento</span>
          <b>{qtdAndamento}</b>
        </div>
        <div className={`kpi ${qtdParaEntregar ? 'destaque' : ''}`}>
          <span className="mudo">Para entregar</span>
          <b>{qtdParaEntregar}</b>
        </div>
      </div>

      {!qtdAbertas && <p className="mudo">Nenhuma conta aberta. As mesas aparecem aqui quando o primeiro pedido é lançado.</p>}
      <div className="grade-mesas">
        {mesasAbertas.map((n) => {
          const r = resumo[n];
          return (
            <button
              key={n}
              className={`mesa-card aberta ${r.paraEntregar ? 'tem-pronto' : ''} ${mesa === n ? 'sel' : ''}`}
              aria-pressed={mesa === n}
              onClick={() => escolherMesa(n)}
            >
              <span className="mesa-num">{n}</span>
              <span className="mesa-valor">{formatarReais(r.total)}</span>
              {r.paraEntregar > 0 && <span className="mesa-aviso">{r.paraEntregar} p/ entregar</span>}
            </button>
          );
        })}
      </div>

      {mesa && (
        <>
          <div className="linha espaco">
            <h2>Mesa {mesa}</h2>
            {conta && !troca && (
              <button className="sec" onClick={() => setTroca({ valor: '', confirmando: false })}>
                Trocar de mesa
              </button>
            )}
          </div>
          {!conta && <p className="mudo">Sem conta aberta.</p>}

          {conta && troca && (
            <div className="card acao-form">
              {!troca.confirmando ? (
                <>
                  <label className="rotulo-campo" htmlFor="nova-mesa">Passar a conta da mesa {mesa} para a mesa</label>
                  <div className="linha">
                    <input
                      id="nova-mesa"
                      inputMode="numeric"
                      value={troca.valor}
                      onChange={(e) => setTroca({ ...troca, valor: e.target.value })}
                      placeholder="Ex.: 15"
                      autoComplete="off"
                    />
                    <button disabled={!mesaNovaOk} onClick={() => setTroca({ ...troca, confirmando: true })}>
                      Trocar
                    </button>
                    <button className="sec" onClick={() => setTroca(null)}>Cancelar</button>
                  </div>
                  {troca.valor !== '' && !mesaNovaOk && (
                    <p className="texto-erro">Digite um número de mesa de 1 a 999, diferente da atual.</p>
                  )}
                </>
              ) : (
                <>
                  <p><b>Tem certeza?</b> A conta inteira da mesa {mesa} vai para a mesa {mesaNova}.</p>
                  <div className="linha">
                    <button onClick={confirmarTroca} disabled={ocupado}>Sim, trocar</button>
                    <button className="sec" onClick={() => setTroca({ ...troca, confirmando: false })}>Voltar</button>
                  </div>
                </>
              )}
            </div>
          )}

          {grupos.length > 0 && (
            <div className="entregas" role="group" aria-label="Entregar">
              {grupos.map((g) => {
                const qtd = itensEntregaveis(g.itens).reduce((soma, i) => soma + i.quantidade, 0);
                return (
                  <button key={g.id} className="entregar" onClick={() => entregar(g)} disabled={!qtd || ocupado}>
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
                <div key={i.id} className={`card ${i.estado === 'pronto' ? 'card-pronto' : ''}`}>
                  <div className="linha espaco">
                    <div>
                      {i.quantidade}x {i.nome_produto}
                      {i.pessoa && <> ({i.pessoa})</>}
                      {i.detalhe && <span className="mudo"> · {i.detalhe}</span>} — {formatarReais(i.preco_centavos * i.quantidade)}{' '}
                      <span className={`tag ${i.estado}`}>{ROTULOS[i.estado]}</span>
                    </div>
                    <div className="linha">
                      {i.estado !== 'cancelado' && mover?.id !== i.id && (
                        <button
                          className="sec"
                          onClick={() => setMover({ id: i.id, valor: i.pessoa ?? '', confirmando: false })}
                        >
                          Pessoa
                        </button>
                      )}
                      {['novo', 'em_preparo', 'pronto'].includes(i.estado) && (
                        <button className="perigo" onClick={() => mudar(i.id, 'cancelado')} disabled={ocupado}>Cancelar</button>
                      )}
                    </div>
                  </div>

                  {mover?.id === i.id && (
                    <div className="acao-form">
                      {!mover.confirmando ? (
                        <>
                          <label className="rotulo-campo" htmlFor={`pessoa-${i.id}`}>Mover para a pessoa (vazio = sem nome)</label>
                          <div className="linha">
                            <input
                              id={`pessoa-${i.id}`}
                              value={mover.valor}
                              onChange={(e) => setMover({ ...mover, valor: e.target.value })}
                              placeholder="Ex.: Maria"
                              autoComplete="off"
                            />
                            <button
                              disabled={nomeIgual || nomeLongo}
                              onClick={() => setMover({ ...mover, confirmando: true })}
                            >
                              Mover
                            </button>
                            <button className="sec" onClick={() => setMover(null)}>Cancelar</button>
                          </div>
                          {nomeLongo && <p className="texto-erro">Nome muito longo (máximo 60 letras).</p>}
                        </>
                      ) : (
                        <>
                          <p>
                            <b>Tem certeza?</b> Mover {i.quantidade}x {i.nome_produto} de{' '}
                            <b>{i.pessoa || 'sem nome'}</b> para <b>{pessoaNova || 'sem nome'}</b>.
                          </p>
                          <div className="linha">
                            <button onClick={confirmarMover} disabled={ocupado}>Sim, mover</button>
                            <button className="sec" onClick={() => setMover({ ...mover, confirmando: false })}>Voltar</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
          {conta && (
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
