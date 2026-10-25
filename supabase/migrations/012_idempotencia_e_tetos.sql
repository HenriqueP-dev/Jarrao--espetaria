-- 012: repetição segura de pedido e de pagamento + tetos de quantidade e valor.
-- (auditoria de 25/10/2026, itens C1, C2 e A3)
--
-- Idempotência: a tela gera uma chave (UUID) para cada pedido/pagamento. Se a internet cair
-- depois de o banco gravar e a tela repetir o envio, a mesma chave devolve o registro que já
-- existe, em vez de criar outro. Sem chave (null), tudo funciona como antes.
-- Tetos (hipótese a confirmar com o dono): quantidade de 1 a 99 por linha, até 60 linhas por
-- pedido, pagamento de até R$ 50.000,00. Mantenha iguais a lib/pedido.js e lib/caixa.js.

alter table pedidos add column if not exists chave uuid;
create unique index if not exists pedidos_chave_unica on pedidos (chave) where chave is not null;

alter table pagamentos add column if not exists chave uuid;
create unique index if not exists pagamentos_chave_unica on pagamentos (chave) where chave is not null;

alter table itens_pedido
  add constraint itens_pedido_quantidade_maxima check (quantidade <= 99);

-- A assinatura muda (novo parâmetro com valor padrão): remove a antiga para não haver duas versões.
drop function if exists criar_pedido(integer, jsonb);

create or replace function criar_pedido(p_mesa integer, p_itens jsonb, p_chave uuid default null)
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
  perform private.exigir_perfil(array['garcom', 'caixa', 'dono']);

  -- Repetição do mesmo envio: devolve o pedido que já foi gravado.
  if p_chave is not null then
    select id into v_pedido from pedidos where chave = p_chave;
    if found then
      return v_pedido;
    end if;
  end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido sem itens';
  end if;
  if jsonb_array_length(p_itens) > 60 then
    raise exception 'Pedido com itens demais (máximo 60 linhas). Divida em dois pedidos.';
  end if;
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

  begin
    insert into pedidos (conta_id, chave) values (v_conta, p_chave) returning id into v_pedido;
  exception when unique_violation then
    -- duas repetições chegaram ao mesmo tempo: vale a que gravou primeiro
    select id into v_pedido from pedidos where chave = p_chave;
    return v_pedido;
  end;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := nullif(v_item->>'quantidade', '')::integer;
    if v_qtd is null or v_qtd < 1 then
      raise exception 'Quantidade inválida';
    end if;
    if v_qtd > 99 then
      raise exception 'Quantidade acima do limite (máximo 99 por item)';
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

grant execute on function criar_pedido(integer, jsonb, uuid) to anon, authenticated;

drop function if exists registrar_pagamento(bigint, text, integer);

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

  -- Repetição do mesmo envio (a conta está travada acima, então não há corrida):
  -- o pagamento já foi gravado, não grava de novo.
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

  select coalesce(sum(valor_centavos), 0) into v_pago from pagamentos where conta_id = p_conta;
  if v_pago + p_valor > total_conta(p_conta) then
    raise exception 'Valor passa do saldo da conta (não há troco no registro)';
  end if;

  insert into pagamentos (conta_id, forma, valor_centavos, chave) values (p_conta, p_forma, p_valor, p_chave);
  insert into historico (conta_id, evento, detalhe)
  values (p_conta, 'pagamento_registrado', p_forma || ' R$ ' || (p_valor / 100.0)::numeric(12,2));
end;
$$;

grant execute on function registrar_pagamento(bigint, text, integer, uuid) to anon, authenticated;
