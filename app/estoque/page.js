'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useTrava } from '../componentes/useTrava';
import { useSessao } from '../componentes/Sessao';
import {
  ROTULO_STATUS,
  descreverMovimento,
  filtrarLinhas,
  lerContagem,
  lerQuantidade,
  ordenarPorUrgencia,
  statusDoSaldo,
  unidadesDaEntrada,
} from '../../lib/estoque';

const NOVA_ACAO = { qtd: '', emb: '', detalhe: '', contado: '', minimo: '', nomeEmb: '', unidEmb: '', parando: false };

// Estoque de bebidas e espetos. Caixa e dono lançam entradas, perdas, consumo e contagem;
// só o dono escolhe o que é controlado. A baixa pelos pedidos é automática (feita no banco).
// O estoque nunca bloqueia uma venda: o saldo pode ficar negativo e vira alerta.
export default function Estoque() {
  const { perfil, loginObrigatorio } = useSessao();
  const dono = perfil === 'dono';
  const [linhas, setLinhas] = useState([]);
  const [embalagens, setEmbalagens] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [livres, setLivres] = useState([]); // produtos ainda sem controle (só o dono vê)
  const [busca, setBusca] = useState('');
  const [soAlertas, setSoAlertas] = useState(false);
  const [buscaLivres, setBuscaLivres] = useState('');
  const [acao, setAcao] = useState(null); // { id, tipo, ...campos }
  const [loteConfirmar, setLoteConfirmar] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const { ocupado, travar } = useTrava();

  const carregar = useCallback(async () => {
    const [s, e, m, p] = await Promise.all([
      supabase.from('estoque_saldos').select('*'),
      supabase.from('produto_embalagens').select('*').order('unidades', { ascending: false }),
      supabase
        .from('estoque_movimentos')
        .select('*, produtos(nome)')
        .order('criado_em', { ascending: false })
        .order('id', { ascending: false })
        .limit(40),
      dono
        ? supabase.from('produtos').select('id, nome, categoria').eq('ativo', true).eq('controla_estoque', false).order('ordem')
        : Promise.resolve({ data: [] }),
    ]);
    const falha = s.error || e.error || m.error || p.error;
    if (falha) return setErro(falha.message);
    setErro(null);
    setLinhas(s.data);
    setEmbalagens(e.data);
    setMovimentos(m.data);
    setLivres(p.data);
  }, [dono]);

  useEffect(() => {
    if (perfil === 'caixa' || perfil === 'dono' || !loginObrigatorio) carregar();
    const tempo = setInterval(carregar, 20000);
    return () => clearInterval(tempo);
  }, [perfil, loginObrigatorio, carregar]);

  const visiveis = useMemo(
    () => ordenarPorUrgencia(filtrarLinhas(linhas, { busca, soAlertas })),
    [linhas, busca, soAlertas]
  );
  const categoriasLivres = useMemo(() => [...new Set(livres.map((p) => p.categoria))], [livres]);
  const livresFiltrados = useMemo(
    () => filtrarLinhas(livres.map((p) => ({ ...p, saldo: 1, estoque_minimo: 0 })), { busca: buscaLivres }),
    [livres, buscaLivres]
  );

  if (loginObrigatorio && perfil !== 'caixa' && perfil !== 'dono') {
    return (
      <>
        <h1>Estoque</h1>
        <div className="aviso">
          <p>Só o caixa e o dono usam esta tela.</p>
          <Link href="/entrar">Entrar</Link>
        </div>
      </>
    );
  }

  const abrir = (id, tipo) => {
    setErro(null);
    setAviso(null);
    setAcao({ id, tipo, ...NOVA_ACAO });
  };
  const campo = (campos) => setAcao((a) => ({ ...a, ...campos }));

  // Uma ação por vez: toque duplo em "Registrar entrada" não lança duas vezes.
  function enviar(rpc, params, mensagem, manter = false) {
    return travar(async () => {
      const { error } = await supabase.rpc(rpc, params);
      if (error) return setErro(error.message);
      setErro(null);
      setAviso(mensagem);
      if (!manter) setAcao(null);
      carregar();
    });
  }

  function controlarLote(categoria) {
    return travar(async () => {
      const alvos = livres.filter((p) => p.categoria === categoria);
      for (const p of alvos) {
        const { error } = await supabase.rpc('definir_controle_estoque', { p_produto: p.id, p_controla: true, p_minimo: 0 });
        if (error) {
          setLoteConfirmar(null);
          return setErro(error.message);
        }
      }
      setLoteConfirmar(null);
      setErro(null);
      setAviso(`${alvos.length} produto(s) de ${categoria} agora têm estoque controlado.`);
      carregar();
    });
  }

  function formulario(l) {
    const a = acao;
    const embs = embalagens.filter((e) => e.produto_id === l.produto_id);
    const embEscolhida = embs.find((e) => String(e.id) === String(a.emb)) ?? null;

    if (a.tipo === 'entrada') {
      const q = lerQuantidade(a.qtd);
      const unidades = q ? unidadesDaEntrada(q, embEscolhida) : null;
      return (
        <div className="acao-form">
          <div className="linha">
            <input
              value={a.qtd}
              onChange={(e) => campo({ qtd: e.target.value })}
              inputMode="numeric"
              placeholder="Quantidade"
              aria-label="Quantidade que entrou"
              style={{ width: 130 }}
            />
            <select value={a.emb} onChange={(e) => campo({ emb: e.target.value })} aria-label="Embalagem">
              <option value="">unidades</option>
              {embs.map((e) => <option key={e.id} value={e.id}>{e.nome} (com {e.unidades})</option>)}
            </select>
            <input
              value={a.detalhe}
              onChange={(e) => campo({ detalhe: e.target.value })}
              placeholder="Observação (nota, fornecedor…)"
              aria-label="Observação"
              maxLength={150}
              style={{ flex: '1 1 180px' }}
            />
          </div>
          {unidades !== null && (
            <p className="mudo">
              Entram {unidades} unidade(s): o saldo vai de {l.saldo} para {l.saldo + unidades}.
            </p>
          )}
          <div className="linha">
            <button
              disabled={q === null || ocupado}
              onClick={() =>
                enviar(
                  'registrar_entrada_estoque',
                  { p_produto: l.produto_id, p_quantidade: q, p_embalagem: embEscolhida ? embEscolhida.id : null, p_detalhe: a.detalhe.trim() || null },
                  `Entrada de ${unidades} un. de ${l.nome} registrada.`
                )
              }
            >
              Registrar entrada
            </button>
            <button className="sec" onClick={() => setAcao(null)}>Cancelar</button>
          </div>
        </div>
      );
    }

    if (a.tipo === 'perda' || a.tipo === 'consumo_interno') {
      const q = lerQuantidade(a.qtd);
      const rotulo = a.tipo === 'perda' ? 'Perda' : 'Consumo interno';
      return (
        <div className="acao-form">
          <div className="linha">
            <input
              value={a.qtd}
              onChange={(e) => campo({ qtd: e.target.value })}
              inputMode="numeric"
              placeholder="Quantidade"
              aria-label={`Quantidade de ${rotulo.toLowerCase()}`}
              style={{ width: 130 }}
            />
            <input
              value={a.detalhe}
              onChange={(e) => campo({ detalhe: e.target.value })}
              placeholder={a.tipo === 'perda' ? 'O que aconteceu? (quebrou, venceu…)' : 'Quem consumiu?'}
              aria-label="Motivo"
              maxLength={150}
              style={{ flex: '1 1 220px' }}
            />
          </div>
          {q !== null && <p className="mudo">{rotulo}: o saldo vai de {l.saldo} para {l.saldo - q}.</p>}
          <div className="linha">
            <button
              className="perigo"
              disabled={q === null || ocupado}
              onClick={() =>
                enviar(
                  'registrar_saida_estoque',
                  { p_produto: l.produto_id, p_tipo: a.tipo, p_quantidade: q, p_detalhe: a.detalhe.trim() || null },
                  `${rotulo} de ${q} un. de ${l.nome} registrado.`
                )
              }
            >
              Registrar {rotulo.toLowerCase()}
            </button>
            <button className="sec" onClick={() => setAcao(null)}>Cancelar</button>
          </div>
        </div>
      );
    }

    if (a.tipo === 'contagem') {
      const c = lerContagem(a.contado);
      return (
        <div className="acao-form">
          <div className="linha">
            <input
              value={a.contado}
              onChange={(e) => campo({ contado: e.target.value })}
              inputMode="numeric"
              placeholder="Quanto você contou?"
              aria-label="Quantidade contada"
              style={{ width: 170 }}
            />
            <input
              value={a.detalhe}
              onChange={(e) => campo({ detalhe: e.target.value })}
              placeholder="Observação (opcional)"
              aria-label="Observação"
              maxLength={150}
              style={{ flex: '1 1 200px' }}
            />
          </div>
          {c !== null && (
            <p className="mudo">
              O sistema tem {l.saldo}. {c === l.saldo ? 'A contagem bate, nada será lançado.' : `Será lançado um ajuste de ${c - l.saldo > 0 ? '+' : '−'}${Math.abs(c - l.saldo)}.`}
            </p>
          )}
          <div className="linha">
            <button
              disabled={c === null || ocupado}
              onClick={() =>
                enviar(
                  'registrar_contagem_estoque',
                  { p_produto: l.produto_id, p_contado: c, p_detalhe: a.detalhe.trim() || null },
                  c === l.saldo ? 'A contagem bate com o sistema.' : `Contagem de ${l.nome} registrada: ${c}.`
                )
              }
            >
              Registrar contagem
            </button>
            <button className="sec" onClick={() => setAcao(null)}>Cancelar</button>
          </div>
        </div>
      );
    }

    // Configurar (só o dono)
    const minimoTexto = a.minimo === '' ? String(l.estoque_minimo) : a.minimo;
    const minimo = lerContagem(minimoTexto);
    const uni = lerQuantidade(a.unidEmb);
    return (
      <div className="acao-form">
        <div className="linha">
          <label>
            <span className="rotulo-campo">Avisar quando chegar em (mínimo)</span>
            <input
              value={minimoTexto}
              onChange={(e) => campo({ minimo: e.target.value })}
              inputMode="numeric"
              style={{ width: 110 }}
            />
          </label>
          <button
            disabled={minimo === null || minimo === l.estoque_minimo}
            onClick={() =>
              enviar('definir_controle_estoque', { p_produto: l.produto_id, p_controla: true, p_minimo: minimo }, `Mínimo de ${l.nome}: ${minimo}.`, true)
            }
          >
            Salvar mínimo
          </button>
        </div>

        <h3>Embalagens</h3>
        {!embs.length && <p className="mudo">Nenhuma ainda. Cadastre, por exemplo, &quot;caixa&quot; com 15 unidades.</p>}
        {embs.map((e) => (
          <div key={e.id} className="linha espaco">
            <span>{e.nome} com {e.unidades} unidades</span>
            <button className="sec" onClick={() => enviar('remover_embalagem', { p_id: e.id }, `Embalagem ${e.nome} removida.`, true)}>Remover</button>
          </div>
        ))}
        <div className="linha">
          <input
            value={a.nomeEmb}
            onChange={(e) => campo({ nomeEmb: e.target.value })}
            placeholder="Nome (caixa, fardo…)"
            aria-label="Nome da embalagem"
            maxLength={30}
            style={{ width: 170 }}
          />
          <input
            value={a.unidEmb}
            onChange={(e) => campo({ unidEmb: e.target.value })}
            inputMode="numeric"
            placeholder="Unidades"
            aria-label="Unidades da embalagem"
            style={{ width: 110 }}
          />
          <button
            disabled={!a.nomeEmb.trim() || uni === null || uni < 2}
            onClick={() =>
              enviar('salvar_embalagem', { p_produto: l.produto_id, p_nome: a.nomeEmb.trim(), p_unidades: uni }, `Embalagem ${a.nomeEmb.trim()} salva.`, true).then(() =>
                campo({ nomeEmb: '', unidEmb: '' })
              )
            }
          >
            Adicionar
          </button>
        </div>

        <div className="linha" style={{ marginTop: 10 }}>
          {!a.parando ? (
            <button className="sec" onClick={() => campo({ parando: true })}>Parar de controlar este produto</button>
          ) : (
            <>
              <span>Os lançamentos antigos ficam guardados. Parar mesmo?</span>
              <button
                className="perigo"
                onClick={() => enviar('definir_controle_estoque', { p_produto: l.produto_id, p_controla: false, p_minimo: l.estoque_minimo }, `${l.nome} saiu do controle de estoque.`)}
              >
                Sim, parar
              </button>
              <button className="sec" onClick={() => campo({ parando: false })}>Voltar</button>
            </>
          )}
          <button className="sec" onClick={() => setAcao(null)}>Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1>Estoque</h1>
      {erro && <div className="erro" role="alert">{erro}</div>}
      {aviso && <div className="ok">{aviso}</div>}

      <div className="linha">
        <input
          className="busca-produto"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto…"
          aria-label="Buscar produto"
          style={{ flex: '1 1 220px' }}
        />
        <button className={soAlertas ? '' : 'sec'} aria-pressed={soAlertas} onClick={() => setSoAlertas(!soAlertas)}>
          Só o que precisa de atenção
        </button>
      </div>

      {!linhas.length && (
        <p className="mudo">
          Nenhum produto com estoque controlado ainda.{' '}
          {dono ? 'Escolha abaixo em "O que controlar". Comece pelas bebidas e pelos espetos.' : 'Peça ao dono para escolher o que controlar.'}
        </p>
      )}

      <ul className="estoque-lista">
        {visiveis.map((l) => {
          const status = statusDoSaldo(l.saldo, l.estoque_minimo);
          return (
            <li key={l.produto_id} className={`estoque-linha ${status}`}>
              <div className="linha espaco">
                <div className="produto-nome">
                  <b>{l.nome}</b>
                  <span className="mudo">{l.categoria} · mínimo {l.estoque_minimo}</span>
                </div>
                <div className="estoque-saldo">
                  <b>{l.saldo}</b>
                  <span className={`tag est-${status}`}>{ROTULO_STATUS[status]}</span>
                </div>
              </div>
              <div className="linha">
                <button onClick={() => abrir(l.produto_id, 'entrada')}>Entrada</button>
                <button className="sec" onClick={() => abrir(l.produto_id, 'perda')}>Perda</button>
                <button className="sec" onClick={() => abrir(l.produto_id, 'consumo_interno')}>Consumo</button>
                <button className="sec" onClick={() => abrir(l.produto_id, 'contagem')}>Contagem</button>
                {dono && <button className="sec" onClick={() => abrir(l.produto_id, 'config')}>Configurar</button>}
              </div>
              {acao?.id === l.produto_id && formulario(l)}
            </li>
          );
        })}
      </ul>

      {dono && (
        <details className="tabela-ver" open={!linhas.length}>
          <summary>O que controlar ({livres.length} produtos ainda sem controle)</summary>
          <p className="mudo">
            Escolha os produtos que entram no estoque. Cada pedido lançado passa a baixar o saldo sozinho. Comece pelas
            bebidas e pelos espetos.
          </p>
          <div className="chips" role="group" aria-label="Controlar uma categoria inteira">
            {categoriasLivres.map((c) => (
              <button key={c} className="sec" onClick={() => setLoteConfirmar(c)}>{c}</button>
            ))}
          </div>
          {loteConfirmar && (
            <div className="aviso">
              <p>
                <b>Controlar todos os produtos de {loteConfirmar}?</b> Eles entram com saldo zero; depois você lança a
                primeira contagem.
              </p>
              <div className="linha">
                <button onClick={() => controlarLote(loteConfirmar)}>Sim, controlar</button>
                <button className="sec" onClick={() => setLoteConfirmar(null)}>Voltar</button>
              </div>
            </div>
          )}
          <input
            type="search"
            value={buscaLivres}
            onChange={(e) => setBuscaLivres(e.target.value)}
            placeholder="Ou buscar um produto…"
            aria-label="Buscar produto sem controle"
            style={{ width: '100%', margin: '8px 0' }}
          />
          {livresFiltrados.slice(0, 30).map((p) => (
            <div key={p.id} className="linha espaco estoque-livre">
              <span>{p.nome} <span className="mudo">· {p.categoria}</span></span>
              <button
                className="sec"
                onClick={() => enviar('definir_controle_estoque', { p_produto: p.id, p_controla: true, p_minimo: 0 }, `${p.nome} agora tem estoque controlado.`)}
              >
                Controlar
              </button>
            </div>
          ))}
          {livresFiltrados.length > 30 && <p className="mudo">Mostrando 30 de {livresFiltrados.length}. Refine a busca.</p>}
        </details>
      )}

      <details className="tabela-ver">
        <summary>Últimos lançamentos ({movimentos.length})</summary>
        {!movimentos.length && <p className="mudo">Nenhum lançamento ainda.</p>}
        {movimentos.map((m) => (
          <div key={m.id} className="mudo">
            {new Date(m.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
            <b>{m.produtos?.nome}</b>: {descreverMovimento(m)}
            {m.usuario_nome && <> · {m.usuario_nome}</>}
          </div>
        ))}
      </details>
    </>
  );
}
