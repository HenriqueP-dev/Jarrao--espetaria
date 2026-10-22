-- Caixa: pagamentos, fechamento de conta e proteção contra cancelar item já pago.
-- Rode este arquivo no SQL Editor do Supabase DEPOIS da 001 e do seed.

create table pagamentos (
  id bigint generated always as identity primary key,
  conta_id bigint not null references contas(id),
  forma text not null check (forma in ('dinheiro', 'debito', 'credito')),
  valor_centavos integer not null check (valor_centavos > 0),
  criado_em timestamptz not null default now()
);

alter table pagamentos enable row level security;
-- PROTÓTIPO SEM LOGIN: leitura livre. Gravação só pelas funções abaixo.
create policy proto_leitura on pagamentos for select using (true);

-- Total dos itens não cancelados de uma conta.
create function total_conta(p_conta bigint)
returns integer
language sql
stable
as $$
  select coalesce(sum(preco_centavos * quantidade), 0)::integer
  from itens_pedido
  where conta_id = p_conta and estado <> 'cancelado';
$$;

create function registrar_pagamento(p_conta bigint, p_forma text, p_valor integer)
returns void
language plpgsql
as $$
declare
  v_conta contas%rowtype;
  v_pago integer;
begin
  -- Trava a conta para dois caixas não pagarem ao mesmo tempo.
  select * into v_conta from contas where id = p_conta for update;
  if not found then
    raise exception 'Conta não encontrada';
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

  select coalesce(sum(valor_centavos), 0) into v_pago from pagamentos where conta_id = p_conta;
  if v_pago + p_valor > total_conta(p_conta) then
    raise exception 'Valor passa do saldo da conta (não há troco no registro)';
  end if;

  insert into pagamentos (conta_id, forma, valor_centavos) values (p_conta, p_forma, p_valor);
  insert into historico (conta_id, evento, detalhe)
  values (p_conta, 'pagamento_registrado', p_forma || ' R$ ' || (p_valor / 100.0)::numeric(12,2));
end;
$$;

create function fechar_conta(p_conta bigint)
returns void
language plpgsql
as $$
declare
  v_conta contas%rowtype;
  v_pendentes integer;
  v_pago integer;
begin
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

  select coalesce(sum(valor_centavos), 0) into v_pago from pagamentos where conta_id = p_conta;
  if v_pago <> total_conta(p_conta) then
    raise exception 'A conta ainda não está paga por completo';
  end if;

  update contas set status = 'fechada' where id = p_conta;
  insert into historico (conta_id, evento) values (p_conta, 'conta_fechada');
end;
$$;

-- Troca a função da 001: agora não deixa cancelar item de conta que já tem pagamento.
create or replace function mudar_estado_item(p_item bigint, p_novo text)
returns void
language plpgsql
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

-- Realtime para o caixa acompanhar pagamentos.
alter publication supabase_realtime add table pagamentos;
alter publication supabase_realtime add table contas;

-- Permissões das novas funções (protótipo sem login).
alter function registrar_pagamento(bigint, text, integer) security definer;
alter function fechar_conta(bigint) security definer;
grant execute on function registrar_pagamento(bigint, text, integer) to anon;
grant execute on function fechar_conta(bigint) to anon;
