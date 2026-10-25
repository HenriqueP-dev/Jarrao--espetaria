-- Migration 007: relatório de vendas (só leitura; não muda tabelas nem dados).
-- HIPÓTESES (ver docs/DECISOES.md):
--  - "Vendido" = itens não cancelados das contas FECHADAS pelo caixa no período.
--  - O dia de uma venda é o dia em que a conta foi fechada (horário de Brasília).
--  - "Recebido" = pagamentos registrados no período, por forma de pagamento.
--  - Cancelamentos = itens cancelados no período, de qualquer conta.
-- A função NÃO é security definer: respeita as regras de acesso de quem chama
-- (quando houver login, o relatório só funcionará para quem puder ler os dados).

create function relatorio_vendas(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
begin
  if p_de is null or p_ate is null then
    raise exception 'Informe as duas datas';
  end if;
  if p_ate < p_de then
    raise exception 'A data final vem antes da inicial';
  end if;
  if p_ate - p_de > 3660 then
    raise exception 'Período grande demais (máximo 10 anos)';
  end if;

  return (
    with fechadas as (
      select c.id as conta_id,
             (min(h.criado_em) at time zone 'America/Sao_Paulo')::date as dia
      from contas c
      join historico h on h.conta_id = c.id and h.evento = 'conta_fechada'
      where c.status = 'fechada'
      group by c.id
    ),
    no_periodo as (
      select * from fechadas where dia between p_de and p_ate
    ),
    itens as (
      select f.dia, f.conta_id, i.nome_produto, i.quantidade, i.preco_centavos
      from no_periodo f
      join itens_pedido i on i.conta_id = f.conta_id and i.estado <> 'cancelado'
    ),
    por_conta as (
      select conta_id, dia, sum(quantidade * preco_centavos)::bigint as total
      from itens
      group by conta_id, dia
    ),
    pagos as (
      select (p.criado_em at time zone 'America/Sao_Paulo')::date as dia, p.forma, p.valor_centavos
      from pagamentos p
      where (p.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    ),
    cancelados as (
      select i.nome_produto, i.quantidade, i.preco_centavos
      from itens_pedido i
      join historico h on h.item_id = i.id and h.evento = 'item_cancelado'
      where i.estado = 'cancelado'
        and (h.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    )
    select jsonb_build_object(
      'de', p_de,
      'ate', p_ate,
      'vendas_centavos', coalesce((select sum(total) from por_conta), 0),
      'contas', (select count(*) from por_conta where total > 0),
      'itens', coalesce((select sum(quantidade) from itens), 0),
      'recebido_centavos', coalesce((select sum(valor_centavos) from pagos), 0),
      'cancelados_qtd', coalesce((select sum(quantidade) from cancelados), 0),
      'cancelados_centavos', coalesce((select sum(quantidade * preco_centavos) from cancelados), 0),
      'por_dia', coalesce((
        select jsonb_agg(jsonb_build_object('dia', dia, 'vendas_centavos', vendas, 'contas', contas) order by dia)
        from (
          select dia, sum(total) as vendas, count(*) filter (where total > 0) as contas
          from por_conta group by dia
        ) d
      ), '[]'::jsonb),
      'por_produto', coalesce((
        select jsonb_agg(jsonb_build_object('nome', nome_produto, 'quantidade', qtd, 'valor_centavos', valor)
                         order by qtd desc, valor desc, nome_produto)
        from (
          select nome_produto, sum(quantidade) as qtd, sum(quantidade * preco_centavos) as valor
          from itens group by nome_produto
        ) p
      ), '[]'::jsonb),
      'por_forma', coalesce((
        select jsonb_agg(jsonb_build_object('forma', forma, 'valor_centavos', valor) order by valor desc)
        from (select forma, sum(valor_centavos) as valor from pagos group by forma) f
      ), '[]'::jsonb)
    )
  );
end;
$$;

grant execute on function relatorio_vendas(date, date) to anon;
