'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, configurado } from '../../lib/supabase';
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
} from '../../lib/caixa';

export default function Caixa() {
  const [contas, setContas] = useState([]); // contas abertas, com itens e pagamentos
  const [selecionada, setSelecionada] = useState(null); // id da conta
  const [forma, setForma] = useState('dinheiro');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  const carregar = useCallback(async () => {
    const { data: abertas, error } = await supabase
      .from('contas')
      .select('*')
      .eq('status', 'aberta')
      .order('mesa_numero');
    if (error) return setErro(error.message);

    const ids = abertas.map((c) => c.id);
    const [it, pg] = await Promise.all([
      ids.length ? supabase.from('itens_pedido').select('*').in('conta_id', ids).order('criado_em') : { data: [] },
      ids.length ? supabase.from('pagamentos').select('*').in('conta_id', ids).order('criado_em') : { data: [] },
    ]);
    if (it.error || pg.error) return setErro((it.error || pg.error).message);

    setErro(null);
    setContas(
      abertas.map((c) => ({
        ...c,
        itens: it.data.filter((i) => i.conta_id === c.id),
        pagamentos: pg.data.filter((p) => p.conta_id === c.id),
      }))
    );
  }, []);

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel('caixa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contas' }, carregar)
      .subscribe();
    const tempo = setInterval(carregar, 15000);
    return () => {
      clearInterval(tempo);
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  const conta = contas.find((c) => c.id === selecionada) ?? null;

  // Ao escolher uma conta, sugere o saldo restante no campo de valor.
  function escolher(c) {
    setSelecionada(c.id);
    setAviso(null);
    setErro(null);
    setValor((saldo(c.itens, c.pagamentos) / 100).toFixed(2));
  }

  async function registrarPagamento() {
    const centavos = parseReais(valor);
    const msg = validarPagamento(conta.itens, conta.pagamentos, forma, centavos);
    if (msg) return setErro(msg);

    const { error } = await supabase.rpc('registrar_pagamento', {
      p_conta: conta.id,
      p_forma: forma,
      p_valor: centavos,
    });
    if (error) return setErro(error.message);
    setAviso(`Pagamento de ${formatarReais(centavos)} registrado.`);
    setErro(null);
    // Sugere o novo saldo restante para o próximo pagamento.
    setValor(((saldo(conta.itens, conta.pagamentos) - centavos) / 100).toFixed(2));
    carregar();
  }

  async function fecharConta() {
    const { error } = await supabase.rpc('fechar_conta', { p_conta: conta.id });
    if (error) return setErro(error.message);
    setAviso(`Conta da mesa ${conta.mesa_numero} fechada.`);
    setErro(null);
    setSelecionada(null);
    carregar();
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
                <div key={p.id} className="extrato-linha">
                  <span>{FORMAS_PAGAMENTO[p.forma]}</span>
                  <span>{formatarReais(p.valor_centavos)}</span>
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
                  <button onClick={registrarPagamento}>Registrar pagamento</button>
                </div>
                <p className="mudo">Registro manual: não confirma a operadora do cartão.</p>
              </div>

              <button className="grande" onClick={fecharConta} disabled={Boolean(motivo)}>
                Fechar conta
              </button>
              {motivo && <p className="mudo">{motivo}</p>}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
