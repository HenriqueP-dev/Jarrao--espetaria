-- Correções encontradas na revisão. Rode DEPOIS da 002 no SQL Editor do Supabase.
--
-- 1. mudar_estado_item perdeu o "security definer" ao ser recriada na 002.
--    Sem ele, anon não consegue gravar (as tabelas só permitem leitura direta).
-- 2. Todas as funções que gravam passam a ter search_path fixo (segurança).
-- 3. criar_pedido: dois garçons abrindo a mesma mesa ao mesmo tempo não
--    perdem mais o pedido; e a validação de quantidade ficou mais clara.

create or replace function criar_pedido(p_mesa integer, p_itens jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta bigint;
  v_pedido bigint;
  v_item jsonb;
  v_prod produtos%rowtype;
  v_item_id bigint;
  v_qtd integer;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido sem itens';
  end if;
  if not exists (select 1 from mesas where numero = p_mesa) then
    raise exception 'Mesa % não existe', p_mesa;
  end if;

  select id into v_conta from contas where mesa_numero = p_mesa and status = 'aberta';
  if v_conta is null then
    insert into contas (mesa_numero) values (p_mesa)
    on conflict (mesa_numero) where status = 'aberta' do nothing
    returning id into v_conta;
    if v_conta is null then
      -- Outro garçom abriu a conta no mesmo instante: usa a dele.
      select id into v_conta from contas where mesa_numero = p_mesa and status = 'aberta';
    else
      insert into historico (conta_id, evento) values (v_conta, 'conta_aberta');
    end if;
  end if;

  insert into pedidos (conta_id) values (v_conta) returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := nullif(v_item->>'quantidade', '')::integer;
    if v_qtd is null or v_qtd < 1 then
      raise exception 'Quantidade inválida';
    end if;

    select * into v_prod from produtos
      where id = nullif(v_item->>'produto_id', '')::bigint and ativo;
    if not found then
      raise exception 'Produto % não existe ou está inativo', v_item->>'produto_id';
    end if;

    insert into itens_pedido
      (pedido_id, conta_id, produto_id, nome_produto, preco_centavos, quantidade, setor, pessoa)
    values
      (v_pedido, v_conta, v_prod.id, v_prod.nome, v_prod.preco_centavos,
       v_qtd, v_prod.setor, nullif(trim(v_item->>'pessoa'), ''))
    returning id into v_item_id;

    insert into historico (conta_id, item_id, evento, detalhe)
    values (v_conta, v_item_id, 'item_registrado',
            v_qtd || 'x ' || v_prod.nome || ' -> ' || v_prod.setor);
  end loop;

  return v_pedido;
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
  select * into v_item from itens_pedido where id = p_item for update;
  if not found then
    raise exception 'Item não encontrado';
  end if;

  if not (
    (v_item.estado = 'novo'       and p_novo in ('em_preparo', 'pronto', 'cancelado')) or
    (v_item.estado = 'em_preparo' and p_novo in ('pronto', 'cancelado')) or
    (v_item.estado = 'pronto'     and p_novo in ('entregue', 'cancelado'))
  ) then
    raise exception 'Transição inválida: % -> %', v_item.estado, p_novo;
  end if;

  if p_novo = 'cancelado' and exists (select 1 from pagamentos where conta_id = v_item.conta_id) then
    raise exception 'A conta já tem pagamento; não é possível cancelar item';
  end if;

  update itens_pedido set estado = p_novo where id = p_item;
  insert into historico (conta_id, item_id, evento, detalhe)
  values (v_item.conta_id, p_item, 'item_' || p_novo,
          v_item.quantidade || 'x ' || v_item.nome_produto);
end;
$$;

-- Estas duas já eram security definer; só fixamos o search_path.
alter function registrar_pagamento(bigint, text, integer) set search_path = public;
alter function fechar_conta(bigint) set search_path = public;
alter function total_conta(bigint) set search_path = public;

-- Garante as permissões (inofensivo se já existirem).
grant execute on function criar_pedido(integer, jsonb) to anon;
grant execute on function mudar_estado_item(bigint, text) to anon;
grant execute on function registrar_pagamento(bigint, text, integer) to anon;
grant execute on function fechar_conta(bigint) to anon;
