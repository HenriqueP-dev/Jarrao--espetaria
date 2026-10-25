'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, configurado } from '../../lib/supabase';
import { formatarReais } from '../../lib/conta';
import { FORMAS_PAGAMENTO } from '../../lib/caixa';
import {
  PERIODOS,
  compactarReais,
  diaCurto,
  escalaY,
  hojeISO,
  intervalo,
  participacao,
  serieDoGrafico,
  ticketMedio,
} from '../../lib/relatorio';

// Relatório de vendas, só leitura. Os números vêm da função relatorio_vendas do banco.
// Vendido = itens não cancelados das contas fechadas pelo caixa; o dia é o do fechamento.
export default function Vendas() {
  const [periodo, setPeriodo] = useState('hoje');
  const [de, setDe] = useState(() => hojeISO());
  const [ate, setAte] = useState(() => hojeISO());
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [marcado, setMarcado] = useState(null); // coluna do gráfico com a dica aberta

  const faixa = periodo === 'personalizado' ? { de, ate } : intervalo(periodo);
  const faixaOk = Boolean(faixa.de && faixa.ate && faixa.ate >= faixa.de);
  const inicio = faixa.de;
  const fim = faixa.ate;

  const carregar = useCallback(async () => {
    if (!faixaOk) return;
    const { data, error } = await supabase.rpc('relatorio_vendas', { p_de: inicio, p_ate: fim });
    setCarregando(false);
    if (error) return setErro(error.message);
    setErro(null);
    setDados(data);
  }, [inicio, fim, faixaOk]);

  useEffect(() => {
    setCarregando(true);
    carregar();
    const canal = supabase
      .channel('vendas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contas' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, carregar)
      .subscribe();
    const tempo = setInterval(carregar, 60000);
    return () => {
      clearInterval(tempo);
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  const serie = useMemo(
    () => (dados ? serieDoGrafico(dados.por_dia, dados.de, dados.ate) : null),
    [dados]
  );
  const maior = serie ? Math.max(0, ...serie.pontos.map((p) => p.vendas)) : 0;
  const indiceMaior = serie ? serie.pontos.findIndex((p) => p.vendas === maior) : -1;
  const escala = escalaY(maior);
  const passoRotulo = serie ? Math.ceil(serie.pontos.length / 7) : 1;
  const topProdutos = dados ? dados.por_produto.slice(0, 10) : [];
  const maiorQtd = topProdutos[0]?.quantidade ?? 0;
  const pontoMarcado = serie && marcado !== null ? serie.pontos[marcado] : null;

  return (
    <>
      <h1>Vendas</h1>
      {!configurado && <div className="aviso">Supabase não configurado (veja o README).</div>}
      {erro && <div className="erro">{erro}</div>}

      <div className="chips" role="group" aria-label="Período">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            className={periodo === p.id ? 'on' : ''}
            aria-pressed={periodo === p.id}
            onClick={() => setPeriodo(p.id)}
          >
            {p.rotulo}
          </button>
        ))}
        <button
          className={periodo === 'personalizado' ? 'on' : ''}
          aria-pressed={periodo === 'personalizado'}
          onClick={() => setPeriodo('personalizado')}
        >
          Escolher datas
        </button>
      </div>

      {periodo === 'personalizado' && (
        <div className="linha datas">
          <label>
            <span className="rotulo-campo">De</span>
            <input type="date" value={de} max={hojeISO()} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label>
            <span className="rotulo-campo">Até</span>
            <input type="date" value={ate} max={hojeISO()} onChange={(e) => setAte(e.target.value)} />
          </label>
        </div>
      )}
      {!faixaOk && <p className="texto-erro">Escolha as duas datas, com a final igual ou depois da inicial.</p>}

      {faixaOk && carregando && !dados && <p className="mudo">Carregando…</p>}

      {faixaOk && dados && (
        <>
          <section className="hero" aria-label="Total vendido">
            <span className="mudo">
              Vendido {dados.de === dados.ate ? `em ${diaCurto(dados.de)}` : `de ${diaCurto(dados.de)} a ${diaCurto(dados.ate)}`}
            </span>
            <b>{formatarReais(Number(dados.vendas_centavos))}</b>
            <span className="mudo">
              {dados.contas} {dados.contas === 1 ? 'conta paga' : 'contas pagas'} · {dados.itens}{' '}
              {Number(dados.itens) === 1 ? 'item' : 'itens'}
            </span>
          </section>

          <div className="tiles">
            <div className="tile">
              <span className="mudo">Ticket médio</span>
              <b>{formatarReais(ticketMedio(Number(dados.vendas_centavos), dados.contas))}</b>
            </div>
            <div className="tile">
              <span className="mudo">Recebido (registrado)</span>
              <b>{formatarReais(Number(dados.recebido_centavos))}</b>
            </div>
            <div className="tile">
              <span className="mudo">Cancelados</span>
              <b>{dados.cancelados_qtd}</b>
              <small>{formatarReais(Number(dados.cancelados_centavos))}</small>
            </div>
          </div>

          <section className="card secao-grafico">
            <h2>Vendas por {serie.tipo === 'dia' ? 'dia' : 'mês'}</h2>
            {maior === 0 ? (
              <p className="mudo">Nenhuma venda fechada neste período.</p>
            ) : (
              <div className="grafico">
                <div className="grafico-eixo" aria-hidden="true">
                  {escala.marcas.map((m) => (
                    <span key={m} style={{ bottom: `${(m / escala.topo) * 100}%` }}>{compactarReais(m)}</span>
                  ))}
                </div>
                <div className="grafico-area">
                  {escala.marcas.slice(1).map((m) => (
                    <div key={m} className="grade-h" style={{ bottom: `${(m / escala.topo) * 100}%` }} />
                  ))}
                  <div className="grafico-colunas">
                    {serie.pontos.map((p, i) => (
                      <div
                        key={p.chave}
                        className={`coluna-g ${marcado === i ? 'on' : ''}`}
                        tabIndex={0}
                        role="img"
                        aria-label={`${p.rotulo}: ${formatarReais(p.vendas)}, ${p.contas} ${p.contas === 1 ? 'conta' : 'contas'}`}
                        onMouseEnter={() => setMarcado(i)}
                        onMouseLeave={() => setMarcado(null)}
                        onFocus={() => setMarcado(i)}
                        onBlur={() => setMarcado(null)}
                      >
                        <div className="barra" style={{ height: `${(p.vendas / escala.topo) * 100}%` }} />
                        {i === indiceMaior && serie.pontos.length <= 31 && (
                          <span className={`valor-topo ${i < 2 ? 'esq' : ''} ${i > serie.pontos.length - 3 ? 'dir' : ''}`}
                                style={{ bottom: `calc(${(p.vendas / escala.topo) * 100}% + 4px)` }}>
                            {formatarReais(p.vendas)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {pontoMarcado && (
                    <div
                      className={`dica ${marcado < 2 ? 'esq' : ''} ${marcado > serie.pontos.length - 3 ? 'dir' : ''}`}
                      style={{ left: `${((marcado + 0.5) / serie.pontos.length) * 100}%` }}
                      role="status"
                    >
                      <b>{pontoMarcado.rotulo}</b>
                      <span>{formatarReais(pontoMarcado.vendas)}</span>
                      <span>{pontoMarcado.contas} {pontoMarcado.contas === 1 ? 'conta' : 'contas'}</span>
                    </div>
                  )}
                </div>
                <div className="grafico-x" aria-hidden="true">
                  {serie.pontos.map((p, i) => (
                    <span key={p.chave}>
                      {i % passoRotulo === 0 && <em>{p.rotulo}</em>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <details className="tabela-ver">
              <summary>Ver como tabela</summary>
              <table>
                <thead>
                  <tr><th>{serie.tipo === 'dia' ? 'Dia' : 'Mês'}</th><th>Contas</th><th>Vendido</th></tr>
                </thead>
                <tbody>
                  {serie.pontos.map((p) => (
                    <tr key={p.chave}><td>{p.rotulo}</td><td>{p.contas}</td><td>{formatarReais(p.vendas)}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          <section className="card">
            <h2>Mais vendidos</h2>
            {!topProdutos.length ? (
              <p className="mudo">Nenhum item vendido neste período.</p>
            ) : (
              <ol className="ranking">
                {topProdutos.map((p) => (
                  <li key={p.nome}>
                    <div className="rk-topo">
                      <span className="rk-nome">{p.nome}</span>
                      <span><b>{p.quantidade}</b> <span className="mudo">· {formatarReais(Number(p.valor_centavos))}</span></span>
                    </div>
                    <div className="rk-trilho"><div style={{ width: `${(p.quantidade / maiorQtd) * 100}%` }} /></div>
                  </li>
                ))}
              </ol>
            )}
            {dados.por_produto.length > 10 && (
              <details className="tabela-ver">
                <summary>Ver todos os {dados.por_produto.length} produtos</summary>
                <table>
                  <thead><tr><th>Produto</th><th>Qtd.</th><th>Vendido</th></tr></thead>
                  <tbody>
                    {dados.por_produto.map((p) => (
                      <tr key={p.nome}><td>{p.nome}</td><td>{p.quantidade}</td><td>{formatarReais(Number(p.valor_centavos))}</td></tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </section>

          <section className="card">
            <h2>Recebido por forma de pagamento</h2>
            {!dados.por_forma.length ? (
              <p className="mudo">Nenhum pagamento registrado neste período.</p>
            ) : (
              <table className="tabela-forma">
                <thead><tr><th>Forma</th><th>Valor</th><th>Parte</th></tr></thead>
                <tbody>
                  {dados.por_forma.map((f) => (
                    <tr key={f.forma}>
                      <td>{FORMAS_PAGAMENTO[f.forma] ?? f.forma}</td>
                      <td>{formatarReais(Number(f.valor_centavos))}</td>
                      <td>{participacao(Number(f.valor_centavos), Number(dados.recebido_centavos)).toString().replace('.', ',')}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mudo">Registro manual feito pelo caixa: não confirma a maquininha.</p>
          </section>

          <p className="mudo nota-relatorio">
            Como ler: &quot;vendido&quot; é o valor dos itens não cancelados das contas que o caixa fechou, no dia do
            fechamento (horário de Brasília). Contas ainda abertas não entram.
          </p>
        </>
      )}
    </>
  );
}
