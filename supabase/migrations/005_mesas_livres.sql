-- Migration 005: mesa com número livre.
-- Antes, criar_pedido só aceitava as mesas cadastradas (1 a 8 e 10 a 23).
-- Agora aceita qualquer número de 1 a 999 e cadastra a mesa na primeira vez
-- (o restaurante às vezes empresta mesas do vizinho). Rode no SQL Editor do Supabase.
-- Não muda tabelas nem apaga dados; só recria a função criar_pedido.

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
  v_detalhe text;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido sem itens';
  end if;
  -- A mesa é um número livre (às vezes o restaurante empresta mesas do vizinho).
  -- Mantenha igual a lib/mesas.js (1 a 999).
  if p_mesa is null or p_mesa < 1 or p_mesa > 999 then
    raise exception 'Mesa inválida: %', p_mesa;
  end if;
  insert into mesas (numero) values (p_mesa) on conflict (numero) do nothing;

  select id into v_conta from contas where mesa_numero = p_mesa and status = 'aberta';
  if v_conta is null then
    insert into contas (mesa_numero) values (p_mesa)
    on conflict (mesa_numero) where status = 'aberta' do nothing
    returning id into v_conta;
    if v_conta is null then
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

    v_detalhe := nullif(trim(v_item->>'detalhe'), '');
    if v_prod.exige_espeto and v_detalhe is null then
      raise exception 'Escolha o espeto de: %', v_prod.nome;
    end if;

    insert into itens_pedido
      (pedido_id, conta_id, produto_id, nome_produto, preco_centavos, quantidade, setor, pessoa, detalhe)
    values
      (v_pedido, v_conta, v_prod.id, v_prod.nome, v_prod.preco_centavos,
       v_qtd, v_prod.setor, nullif(trim(v_item->>'pessoa'), ''), v_detalhe)
    returning id into v_item_id;

    insert into historico (conta_id, item_id, evento, detalhe)
    values (v_conta, v_item_id, 'item_registrado',
            v_qtd || 'x ' || v_prod.nome || ' -> ' || v_prod.setor
            || coalesce(' (' || v_detalhe || ')', ''));
  end loop;

  return v_pedido;
end;
$$;
