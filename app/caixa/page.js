'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, configurado } from '../../lib/supabase';
import { mensagemDeErro } from '../../lib/erros';
import { criarGuardaChave } from '../../lib/chave';
import { useTrava } from '../componentes/useTrava';
import { useTempoReal } from '../componentes/useTempoReal';
import { ROTULOS } from '../../lib/estados';
import { formatarReais } from '../../lib/conta';
import {
  FORMAS_PAGAMENTO,
  totalItens,
  totalPago,
  saldo,
  parseReais,
  motivoNaoFechar,
  validarPagamento,
  erroMotivoEstorno,
} from '../../lib/caixa';
import { useSessao } from '../componentes/Sessao';

export default function Caixa() {
  const [contas, setContas] = useState([]); // contas abertas, com itens e pagamentos
  const [selecionada, setSelecionada] = useState(null); // id da conta
  const [forma, setForma] = useState('dinheiro');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const { ocupado, travar } = useTrava();
  const chaves = useRef(criarGuardaChave());
  const { perfil } = useSessao();
  const [estorno, setEstorno] = useState(null); // { id, motivo, confirmando } — só o dono
  const selRef = useRef(selecionada);
  selRef.current = selecionada;

  const carregar = useCallback(async () => {
    const { data: abertas, error } = await supabase
      .from('contas')
      .select('*')
      .eq('status', 'aberta')
      .order('mesa_numero');
    if (error) return setErro(mensagemDeErro(error));

    const ids = abertas.map((c) => c.id);
    // O histórico (a lista que mais cresce) só da conta aberta na tela, não de todas.
    const historicoDe = ids.includes(selRef.current) ? selRef.current : null;
    const [it, pg, hi] = await Promise.all([
      ids.length ? supabase.from('itens_pedido').select('*').in('conta_id', ids).order('criado_em') : { data: [] },
      ids.length ? supabase.from('pagamentos').select('*').in('conta_id', ids).order('criado_em') : { data: [] },
      historicoDe
        ? supabase.from('historico').select('*').eq('conta_id', historicoDe).order('criado_em').order('id')
        : { data: [] },
    ]);
    if (it.error || pg.error || hi.error) return setErro(mensagemDeErro(it.error || pg.error || hi.error));

    setErro(null);
    setContas(
      abertas.map((c) => ({
        ...c,
        itens: it.data.filter((i) => i.conta_id === c.id),
        pagamentos: pg.data.filter((p) => p.conta_id === c.id),
        historico: c.id === historicoDe ? hi.data : [],
      }))
    );
  }, []);

  useTempoReal({ nome: 'caixa', tabelas: ['itens_pedido', 'pagamentos', 'contas'], carregar });
  // Trocou de conta: busca o histórico dela (sem refazer a assinatura do tempo real).
  useEffect(() => {
    if (selecionada !== null) carregar();
  }, [selecionada, carregar]);

  const conta = contas.find((c) => c.id === selecionada) ?? null;

  // Ao escolher uma conta, sugere o saldo restante no campo de valor.
  function escolher(c) {
    setSelecionada(c.id);
    setEstorno(null);
    setAviso(null);
    setErro(null);
    setValor((saldo(c.itens, c.pagamentos) / 100).toFixed(2));
  }

  function registrarPagamento() {
    return travar(async () => {
      const centavos = parseReais(valor);
      const msg = validarPagamento(conta.itens, conta.pagamentos, forma, centavos);
      if (msg) return setErro(msg);

      // Mesma chave enquanto for "o mesmo" pagamento (conta, forma e valor) que ainda não
      // deu certo: repetir o envio não registra duas vezes (migration 012).
      const chave = chaves.current.para(`${conta.id}|${forma}|${centavos}`);
      const { error } = await supabase.rpc('registrar_pagamento', {
        p_conta: conta.id,
        p_forma: forma,
        p_valor: centavos,
        p_chave: chave,
      });
      if (error) {
        const rede = /fetch|network|failed/i.test(error.message);
        return setErro(
          rede ? 'Sem conexão. Confira o extrato e toque de novo se o pagamento não aparecer (não será duplicado).' : mensagemDeErro(error)
        );
      }
      chaves.current.liberar();
      setAviso(`Pagamento de ${formatarReais(centavos)} registrado.`);
      setErro(null);
      // Sugere o novo saldo restante para o próximo pagamento.
      setValor(((saldo(conta.itens, conta.pagamentos) - centavos) / 100).toFixed(2));
      carregar();
    });
  }

  function fecharConta() {
    return travar(async () => {
      const { error } = await supabase.rpc('fechar_conta', { p_conta: conta.id });
      if (error) return setErro(mensagemDeErro(error));
      setAviso(`Conta da mesa ${conta.mesa_numero} fechada.`);
      setErro(null);
      setSelecionada(null);
      carregar();
    });
  }

  // Estorno (só o dono, migration 015): o pagamento fica na lista, riscado, com o motivo.
  function confirmarEstorno() {
    return travar(async () => {
      const msg = erroMotivoEstorno(estorno.motivo);
      if (msg) return setErro(msg);
      const { error } = await supabase.rpc('estornar_pagamento', {
        p_pagamento: estorno.id,
        p_motivo: estorno.motivo.trim(),
      });
      if (error) {
        setEstorno({ ...estorno, confirmando: false });
        return setErro(mensagemDeErro(error));
      }
      setErro(null);
      setAviso('Pagamento estornado. Registre o valor certo, se for o caso.');
      setEstorno(null);
      carregar();
    });
  }

  const motivo = conta ? motivoNaoFechar(conta.itens, conta.pagamentos) : null;

  return (
    <>
      <h1>Caixa</h1>
      {!configurado && <div className="aviso">Supabase não configurado (veja o README).</div>}
      {erro && <div className="erro">{erro}</div>}
      {aviso && <div className="ok">{aviso}</div>}

      <div className="caixa-layout">
        <section>
          <h2>Contas abertas</h2>
          {!contas.length && <p className="mudo">Nenhuma conta aberta.</p>}
          {contas.map((c) => {
            const falta = saldo(c.itens, c.pagamentos);
            return (
              <button
                key={c.id}
                className={`conta-lista ${selecionada === c.id ? 'sel' : ''}`}
                aria-pressed={selecionada === c.id}
                onClick={() => escolher(c)}
              >
                <span className="linha espaco">
                  <strong className="conta-mesa">Mesa {c.mesa_numero}</strong>
                  <strong>{formatarReais(totalItens(c.itens))}</strong>
                </span>
                <span className="mudo">
                  pago {formatarReais(totalPago(c.pagamentos))} · falta {formatarReais(falta)}
                </span>
              </button>
            );
          })}
        </section>

        <section>
          {!conta && contas.length > 0 && <p className="mudo">Escolha uma conta para conferir e receber.</p>}
          {conta && (
            <div className="fechamento">
              <h2 style={{ marginTop: 0 }}>Mesa {conta.mesa_numero}</h2>

              <div className="extrato">
                {conta.itens.map((i) => (
                  <div key={i.id} className={`extrato-linha ${i.estado === 'cancelado' ? 'cancelado' : ''}`}>
                    <span>
                      {i.quantidade}x {i.nome_produto}
                      {i.pessoa && <> ({i.pessoa})</>}
                      {i.detalhe && <span className="mudo"> · {i.detalhe}</span>}{' '}
                      <span className={`tag ${i.estado}`}>{ROTULOS[i.estado]}</span>
                    </span>
                    <span>{formatarReais(i.preco_centavos * i.quantidade)}</span>
                  </div>
                ))}
                <div className="extrato-total">
                  <span>Total</span>
                  <span>{formatarReais(totalItens(conta.itens))}</span>
                </div>
              </div>

              <h3>Pagamentos</h3>
              {!conta.pagamentos.length && <p className="mudo">Nenhum pagamento ainda.</p>}
              {conta.pagamentos.map((p) => (
                <div key={p.id}>
                  <div className={`extrato-linha ${p.estornado_em ? 'cancelado' : ''}`}>
                    <span>
                      {FORMAS_PAGAMENTO[p.forma]}
                      {p.estornado_em && <span className="mudo"> · estornado: {p.estorno_motivo}</span>}
                    </span>
                    <span className="linha">
                      {formatarReais(p.valor_centavos)}
                      {perfil === 'dono' && !p.estornado_em && estorno?.id !== p.id && (
                        <button
                          className="sec leve"
                          onClick={() => setEstorno({ id: p.id, motivo: '', confirmando: false })}
                        >
                          Estornar
                        </button>
                      )}
                    </span>
                  </div>
                  {estorno?.id === p.id && (
                    <div className="card acao-form">
                      {!estorno.confirmando ? (
                        <>
                          <input
                            value={estorno.motivo}
                            onChange={(e) => setEstorno({ ...estorno, motivo: e.target.value })}
                            placeholder="Motivo (ex.: era débito, não crédito)"
                            aria-label="Motivo do estorno"
                            maxLength={200}
                          />
                          <div className="linha">
                            <button
                              disabled={Boolean(erroMotivoEstorno(estorno.motivo))}
                              onClick={() => setEstorno({ ...estorno, confirmando: true })}
                            >
                              Continuar
                            </button>
                            <button className="sec" onClick={() => setEstorno(null)}>Cancelar</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p>
                            <b>Estornar {formatarReais(p.valor_centavos)} ({FORMAS_PAGAMENTO[p.forma]})?</b> O valor
                            volta a faltar na conta e o estorno fica no histórico.
                          </p>
                          <div className="linha">
                            <button className="perigo" onClick={confirmarEstorno} disabled={ocupado}>
                              Sim, estornar
                            </button>
                            <button className="sec" onClick={() => setEstorno({ ...estorno, confirmando: false })}>
                              Voltar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div className="falta">
                <span>Falta receber</span>
                <b>{formatarReais(saldo(conta.itens, conta.pagamentos))}</b>
              </div>

              <div className="card">
                <div className="linha">
                  <select value={forma} onChange={(e) => setForma(e.target.value)} aria-label="Forma de pagamento">
                    {Object.entries(FORMAS_PAGAMENTO).map(([k, rotulo]) => (
                      <option key={k} value={k}>{rotulo}</option>
                    ))}
                  </select>
                  <input
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label="Valor recebido"
                    style={{ width: 120 }}
                  />
                  <button onClick={registrarPagamento} disabled={ocupado}>
                    {ocupado ? 'Registrando…' : 'Registrar pagamento'}
                  </button>
                </div>
                <p className="mudo">Registro manual: não confirma a operadora do cartão.</p>
              </div>

              <button className="grande" onClick={fecharConta} disabled={Boolean(motivo) || ocupado}>
                Fechar conta
              </button>
              {motivo && <p className="mudo">{motivo}</p>}

              {conta.historico.length > 0 && (
                <details className="historico-conta">
                  <summary>Histórico da conta ({conta.historico.length})</summary>
                  {conta.historico.map((h) => (
                    <div key={h.id} className="mudo">
                      {new Date(h.criado_em).toLocaleTimeString('pt-BR')} — {h.evento}
                      {h.detalhe && `: ${h.detalhe}`}
                    </div>
                  ))}
                </details>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
