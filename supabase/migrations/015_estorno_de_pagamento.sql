-- 015: estorno de pagamento (auditoria de 25/10/2026, etapa 5).
--
-- Antes, um pagamento registrado errado (valor ou forma) não tinha volta pela tela.
-- Agora o dono pode ESTORNAR um pagamento de conta aberta, com motivo. Nada é apagado: o
-- pagamento continua na tabela, marcado como estornado, e o estorno vai para o histórico com o
-- nome de quem fez. Pagamento estornado deixa de contar no saldo, no fechamento e no relatório.
--
-- HIPÓTESES (a confirmar com o dono, ver docs/DECISOES.md):
--   - só o dono estorna (é dinheiro; o caixa pede ao dono);
--   - só em conta aberta (conta fechada não reabre);
--   - motivo obrigatório, de 3 a 200 letras.

alter table pagamentos
  add column if not exists estornado_em timestamptz,
  add column if not exists estorno_motivo text;

alter table pagamentos
  add constraint pagamentos_estorno_completo
    check ((estornado_em is null) = (estorno_motivo is null)),
  add constraint pagamentos_estorno_motivo_tamanho
    check (estorno_motivo is null or char_length(estorno_motivo) between 3 and 200);

create or replace function estornar_pagamento(p_pagamento bigint, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pag pagamentos%rowtype;
  v_motivo text := nullif(trim(p_motivo), '');
begin
  perform private.exigir_perfil(array['dono']);

  select * into v_pag from pagamentos where id = p_pagamento;
  if not found then
    raise exception 'Pagamento não encontrado';
  end if;
  -- trava a conta, como registrar_pagamento e fechar_conta, para não haver corrida
  perform 1 from contas where id = v_pag.conta_id and status = 'aberta' for update;
  if not found then
    raise exception 'Conta já está fechada: o pagamento não pode ser estornado';
  end if;
  select * into v_pag from pagamentos where id = p_pagamento for update;
  if v_pag.estornado_em is not null then
    raise exception 'Este pagamento já foi estornado';
  end if;
  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception 'Escreva o motivo do estorno';
  end if;
  if char_length(v_motivo) > 200 then
    raise exception 'Motivo muito longo (máximo 200 letras)';
  end if;

  update pagamentos set estornado_em = now(), estorno_motivo = v_motivo where id = p_pagamento;
  insert into historico (conta_id, evento, detalhe)
  values (v_pag.conta_id, 'pagamento_estornado',
          v_pag.forma || ' R$ ' || (v_pag.valor_centavos / 100.0)::numeric(12,2) || ' (' || v_motivo || ')');
end;
$$;

revoke execute on function estornar_pagamento(bigint, text) from public, anon;
grant execute on function estornar_pagamento(bigint, text) to authenticated;

-- Daqui para baixo: as mesmas funções de antes, contando só pagamentos NÃO estornados.

create or replace function registrar_pagamento(p_conta bigint, p_forma text, p_valor integer, p_chave uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta contas%rowtype;
  v_pago integer;
begin
  perform private.exigir_perfil(array['caixa', 'dono']);
  select * into v_conta from contas where id = p_conta for update;
  if not found then
    raise exception 'Conta não encontrada';
  end if;

  if p_chave is not null and exists (select 1 from pagamentos where chave = p_chave) then
    return;
  end if;

  if v_conta.status <> 'aberta' then
    raise exception 'Conta já está fechada';
  end if;
  if p_forma not in ('dinheiro', 'debito', 'credito') then
    raise exception 'Forma de pagamento inválida';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor inválido';
  end if;
  if p_valor > 5000000 then
    raise exception 'Valor acima do limite (R$ 50.000,00 por pagamento)';
  end if;

  select coalesce(sum(valor_centavos), 0) into v_pago
  from pagamentos where conta_id = p_conta and estornado_em is null;
  if v_pago + p_valor > total_conta(p_conta) then
    raise exception 'Valor passa do saldo da conta (não há troco no registro)';
  end if;

  insert into pagamentos (conta_id, forma, valor_centavos, chave) values (p_conta, p_forma, p_valor, p_chave);
  insert into historico (conta_id, evento, detalhe)
  values (p_conta, 'pagamento_registrado', p_forma || ' R$ ' || (p_valor / 100.0)::numeric(12,2));
end;
$$;

create or replace function fechar_conta(p_conta bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta contas%rowtype;
  v_pendentes integer;
  v_pago integer;
begin
  perform private.exigir_perfil(array['caixa', 'dono']);
  select * into v_conta from contas where id = p_conta for update;
  if not found then
    raise exception 'Conta não encontrada';
  end if;
  if v_conta.status <> 'aberta' then
    raise exception 'Conta já está fechada';
  end if;

  select count(*) into v_pendentes from itens_pedido
  where conta_id = p_conta and estado in ('novo', 'em_preparo', 'pronto');
  if v_pendentes > 0 then
    raise exception 'Ainda há % item(ns) não entregue(s)', v_pendentes;
  end if;

  select coalesce(sum(valor_centavos), 0) into v_pago
  from pagamentos where conta_id = p_conta and estornado_em is null;
  if v_pago <> total_conta(p_conta) then
    raise exception 'A conta ainda não está paga por completo';
  end if;

  update contas set status = 'fechada' where id = p_conta;
  insert into historico (conta_id, evento) values (p_conta, 'conta_fechada');
end;
$$;

create or replace function mudar_estado_item(p_item bigint, p_novo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item itens_pedido%rowtype;
begin
  perform private.exigir_perfil(array['garcom', 'cozinha', 'churrasqueira', 'caixa', 'dono']);
  select * into v_item from itens_pedido where id = p_item for update;
  if not found then
    raise exception 'Item não encontrado';
  end if;

  perform private.exigir_perfil(
    case p_novo
      when 'cancelado' then array['caixa', 'dono']::text[]
      when 'entregue' then array['garcom', 'caixa', 'dono']::text[]
      else array['caixa', 'dono', v_item.setor]::text[]
    end);

  if not (
    (v_item.estado = 'novo'       and v_item.setor <> 'garcom' and p_novo in ('em_preparo', 'pronto', 'cancelado')) or
    (v_item.estado = 'novo'       and v_item.setor = 'garcom'  and p_novo in ('entregue', 'cancelado')) or
    (v_item.estado = 'em_preparo' and p_novo in ('pronto', 'cancelado')) or
    (v_item.estado = 'pronto'     and p_novo in ('entregue', 'cancelado'))
  ) then
    raise exception 'Transição inválida: % -> %', v_item.estado, p_novo;
  end if;

  -- pagamento estornado não conta: depois de estornar tudo, dá para cancelar item de novo
  if p_novo = 'cancelado' and exists (
    select 1 from pagamentos where conta_id = v_item.conta_id and estornado_em is null
  ) then
    raise exception 'A conta já tem pagamento; não é possível cancelar item';
  end if;

  update itens_pedido set estado = p_novo where id = p_item;
  insert into historico (conta_id, item_id, evento, detalhe)
  values (v_item.conta_id, p_item, 'item_' || p_novo,
          v_item.quantidade || 'x ' || v_item.nome_produto);
end;
$$;

create or replace function relatorio_vendas(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
begin
  perform private.exigir_perfil(array['caixa', 'dono']);
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
        and p.estornado_em is null
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
