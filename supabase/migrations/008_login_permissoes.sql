-- Migration 008: login e permissões, em MODO DE TRANSIÇÃO.
--
-- Nada muda para a equipe até alguém ligar a chave (configuracao.exigir_login):
--  * chave DESLIGADA (padrão): o sistema funciona aberto, como antes. Se a pessoa
--    estiver logada, o nome dela é gravado no histórico.
--  * chave LIGADA: só entra quem tem login E perfil ativo, e cada função do banco
--    confere o perfil de quem chama. Ligar e desligar é um UPDATE (reversível).
--
-- HIPÓTESES de permissão (ver docs/DECISOES.md), a confirmar com o dono:
--  garçom ........ lançar pedido, entregar, trocar mesa, mover item entre pessoas
--  cozinha ....... preparar e dar ciente só nos itens do setor cozinha
--  churrasqueira . preparar e dar ciente só nos itens do setor churrasqueira
--  caixa ......... tudo do atendimento + cancelar, receber, fechar conta, ver vendas
--  dono .......... tudo + gerenciar a equipe e a chave do login
-- Cancelar item: só caixa e dono (a dona cancela, segundo o desenvolvedor).

-- 1. Schema privado: funções auxiliares que NÃO ficam expostas pela API -------------
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- 2. Tabelas ---------------------------------------------------------------------
create table configuracao (
  id boolean primary key default true check (id), -- só pode existir uma linha
  exigir_login boolean not null default false
);
insert into configuracao (id) values (true);

create table perfis (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 60),
  perfil text not null check (perfil in ('garcom', 'cozinha', 'churrasqueira', 'caixa', 'dono')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table configuracao enable row level security;
alter table perfis enable row level security;

-- Quem grava o histórico: o nome de quem estava logado (se houver).
alter table historico add column usuario_id uuid;
alter table historico add column usuario_nome text;

-- Moderação das permissões da API: gravar só pelas funções; nada de escrita direta.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
grant select on configuracao to anon, authenticated;
grant select on perfis to authenticated;

-- 3. Funções auxiliares (schema private) -------------------------------------------
create function private.login_exigido()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.exigir_login from public.configuracao c), false);
$$;

create function private.perfil_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.perfil from public.perfis p where p.user_id = (select auth.uid()) and p.ativo;
$$;

-- Pode ler os dados do dia a dia? Modo aberto: sim. Modo com login: só com perfil ativo.
create function private.acesso_liberado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.login_exigido() or private.perfil_atual() is not null;
$$;

-- Pode ler pagamentos? Modo aberto: sim. Modo com login: só caixa e dono.
create function private.acesso_caixa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.login_exigido() or coalesce(private.perfil_atual() in ('caixa', 'dono'), false);
$$;

-- Porteiro das funções de gravação: no modo aberto deixa passar; no modo com login
-- exige uma pessoa logada, com perfil ativo, que esteja na lista de perfis permitidos.
create function private.exigir_perfil(p_permitidos text[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_perfil text;
begin
  if not private.login_exigido() then
    return;
  end if;
  if (select auth.uid()) is null then
    raise exception 'Entre no sistema para continuar' using errcode = '42501';
  end if;
  v_perfil := private.perfil_atual();
  if v_perfil is null then
    raise exception 'Seu usuário ainda não tem perfil ou está desativado' using errcode = '42501';
  end if;
  if not (v_perfil = any (p_permitidos)) then
    raise exception 'O perfil % não pode fazer isto', v_perfil using errcode = '42501';
  end if;
end;
$$;

-- Grava o autor em todo evento do histórico, sem mexer nas funções de gravação.
create function private.preencher_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.usuario_id := (select auth.uid());
  if new.usuario_id is not null then
    new.usuario_nome := (select p.nome from public.perfis p where p.user_id = new.usuario_id);
  end if;
  return new;
end;
$$;

create trigger historico_autor
  before insert on historico
  for each row execute function private.preencher_autor();

revoke all on function private.login_exigido(), private.perfil_atual(), private.acesso_liberado(),
  private.acesso_caixa(), private.exigir_perfil(text[]), private.preencher_autor() from public;
grant execute on function private.login_exigido(), private.perfil_atual(), private.acesso_liberado(),
  private.acesso_caixa(), private.exigir_perfil(text[]) to anon, authenticated;

-- 4. Quem pode LER o quê (regras de linha) ------------------------------------------
create policy leitura_config on configuracao for select using (true);

create policy perfis_leitura on perfis for select to authenticated
  using (user_id = (select auth.uid()) or (select private.perfil_atual()) = 'dono');

drop policy proto_leitura on produtos;
drop policy proto_leitura on mesas;
drop policy proto_leitura on contas;
drop policy proto_leitura on pedidos;
drop policy proto_leitura on itens_pedido;
drop policy proto_leitura on historico;
drop policy proto_leitura on pagamentos;

create policy leitura_equipe on produtos for select using ((select private.acesso_liberado()));
create policy leitura_equipe on mesas for select using ((select private.acesso_liberado()));
create policy leitura_equipe on contas for select using ((select private.acesso_liberado()));
create policy leitura_equipe on pedidos for select using ((select private.acesso_liberado()));
create policy leitura_equipe on itens_pedido for select using ((select private.acesso_liberado()));
create policy leitura_equipe on historico for select using ((select private.acesso_liberado()));
create policy leitura_caixa on pagamentos for select using ((select private.acesso_caixa()));

-- 5. Funções de gravação, agora com o porteiro -----------------------------------------
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
  perform private.exigir_perfil(array['garcom', 'caixa', 'dono']);
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido sem itens';
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

  -- Quem pode levar o item para cada estado (o setor do item libera o perfil do setor).
  perform private.exigir_perfil(
    case p_novo
      when 'cancelado' then array['caixa', 'dono']::text[]
      when 'entregue' then array['garcom', 'caixa', 'dono']::text[]
      else array['caixa', 'dono', v_item.setor]::text[]
    end);

  -- Itens do setor 'garcom' (bebidas) não passam por preparo: vão de Novo direto
  -- para Entregue (ou Cancelado). Mantenha igual a lib/estados.js.
  if not (
    (v_item.estado = 'novo'       and v_item.setor <> 'garcom' and p_novo in ('em_preparo', 'pronto', 'cancelado')) or
    (v_item.estado = 'novo'       and v_item.setor = 'garcom'  and p_novo in ('entregue', 'cancelado')) or
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

create or replace function mudar_estado_itens(p_itens bigint[], p_novo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  perform private.exigir_perfil(array['garcom', 'cozinha', 'churrasqueira', 'caixa', 'dono']);
  if p_itens is null or cardinality(p_itens) = 0 then
    raise exception 'Nenhum item informado';
  end if;
  foreach v_id in array p_itens loop
    perform mudar_estado_item(v_id, p_novo);
  end loop;
end;
$$;

create or replace function confirmar_cancelamento(p_item bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v itens_pedido%rowtype;
begin
  perform private.exigir_perfil(array['garcom', 'cozinha', 'churrasqueira', 'caixa', 'dono']);
  select * into v from itens_pedido where id = p_item for update;
  if not found then
    raise exception 'Item não encontrado';
  end if;
  -- O setor do item dá o ciente; caixa e dono também podem.
  perform private.exigir_perfil(array['caixa', 'dono', v.setor]::text[]);
  if v.estado <> 'cancelado' then
    raise exception 'O item não está cancelado';
  end if;
  if v.cancelamento_visto_em is not null then
    return; -- alguém do setor já deu ciente
  end if;

  update itens_pedido set cancelamento_visto_em = now() where id = p_item;
  insert into historico (conta_id, item_id, evento, detalhe)
  values (v.conta_id, p_item, 'cancelamento_visto',
          v.quantidade || 'x ' || v.nome_produto || ' (' || v.setor || ')');
end;
$$;

create or replace function trocar_mesa(p_conta bigint, p_mesa integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v contas%rowtype;
begin
  perform private.exigir_perfil(array['garcom', 'caixa', 'dono']);
  if p_mesa is null or p_mesa < 1 or p_mesa > 999 then
    raise exception 'Mesa inválida: %', p_mesa;
  end if;
  select * into v from contas where id = p_conta for update;
  if not found then
    raise exception 'Conta não encontrada';
  end if;
  if v.status <> 'aberta' then
    raise exception 'A conta já está fechada';
  end if;
  if v.mesa_numero = p_mesa then
    raise exception 'A conta já está na mesa %', p_mesa;
  end if;
  if exists (select 1 from contas where mesa_numero = p_mesa and status = 'aberta') then
    raise exception 'A mesa % já tem uma conta aberta', p_mesa;
  end if;

  insert into mesas (numero) values (p_mesa) on conflict (numero) do nothing;
  update contas set mesa_numero = p_mesa where id = p_conta;
  insert into historico (conta_id, evento, detalhe)
  values (p_conta, 'mesa_trocada', 'mesa ' || v.mesa_numero || ' -> mesa ' || p_mesa);
end;
$$;

create or replace function mudar_pessoa_item(p_item bigint, p_pessoa text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v itens_pedido%rowtype;
  v_nova text := nullif(trim(p_pessoa), '');
begin
  perform private.exigir_perfil(array['garcom', 'caixa', 'dono']);
  select * into v from itens_pedido where id = p_item for update;
  if not found then
    raise exception 'Item não encontrado';
  end if;
  if v.estado = 'cancelado' then
    raise exception 'Item cancelado não pode ser movido';
  end if;
  if exists (select 1 from contas where id = v.conta_id and status <> 'aberta') then
    raise exception 'A conta já está fechada';
  end if;
  if v_nova is not null and char_length(v_nova) > 60 then
    raise exception 'Nome muito longo (máximo 60 letras)';
  end if;
  if coalesce(v.pessoa, '') = coalesce(v_nova, '') then
    return; -- nada mudou
  end if;

  update itens_pedido set pessoa = v_nova where id = p_item;
  insert into historico (conta_id, item_id, evento, detalhe)
  values (v.conta_id, p_item, 'item_pessoa_alterada',
          v.quantidade || 'x ' || v.nome_produto || ': '
          || coalesce(v.pessoa, '(sem nome)') || ' -> ' || coalesce(v_nova, '(sem nome)'));
end;
$$;

create or replace function registrar_pagamento(p_conta bigint, p_forma text, p_valor integer)
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

  select coalesce(sum(valor_centavos), 0) into v_pago from pagamentos where conta_id = p_conta;
  if v_pago <> total_conta(p_conta) then
    raise exception 'A conta ainda não está paga por completo';
  end if;

  update contas set status = 'fechada' where id = p_conta;
  insert into historico (conta_id, evento) values (p_conta, 'conta_fechada');
end;
$$;

-- Relatório: só caixa e dono (no modo com login). Continua sem security definer.
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

-- 6. Gestão da equipe (só o dono; vale mesmo com a chave desligada) ---------------------
create function equipe()
returns table (user_id uuid, email text, nome text, perfil text, ativo boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.perfil_atual() is distinct from 'dono' then
    raise exception 'Só o dono vê a equipe' using errcode = '42501';
  end if;
  return query
    select p.user_id, u.email::text, p.nome, p.perfil, p.ativo
    from public.perfis p
    join auth.users u on u.id = p.user_id
    order by p.nome;
end;
$$;

create function usuarios_sem_perfil()
returns table (id uuid, email text, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.perfil_atual() is distinct from 'dono' then
    raise exception 'Só o dono vê os usuários novos' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, u.created_at
    from auth.users u
    where not exists (select 1 from public.perfis p where p.user_id = u.id)
    order by u.created_at;
end;
$$;

create function definir_perfil(p_user uuid, p_nome text, p_perfil text, p_ativo boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outros_donos integer;
begin
  if private.perfil_atual() is distinct from 'dono' then
    raise exception 'Só o dono pode mudar perfis' using errcode = '42501';
  end if;
  if p_perfil not in ('garcom', 'cozinha', 'churrasqueira', 'caixa', 'dono') then
    raise exception 'Perfil inválido';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'Usuário não encontrado';
  end if;
  -- Nunca deixar o sistema sem nenhum dono ativo.
  select count(*) into v_outros_donos from public.perfis
    where perfil = 'dono' and ativo and user_id <> p_user;
  if v_outros_donos = 0 and not (p_perfil = 'dono' and p_ativo) then
    raise exception 'Precisa existir pelo menos um dono ativo';
  end if;

  insert into public.perfis (user_id, nome, perfil, ativo)
  values (p_user, p_nome, p_perfil, p_ativo)
  on conflict (user_id) do update
    set nome = excluded.nome, perfil = excluded.perfil, ativo = excluded.ativo;
end;
$$;

-- Liga ou desliga a exigência de login. Só um dono logado pode (por segurança, nunca
-- por alguém sem login). Também dá para mudar direto no banco (UPDATE em configuracao).
create function definir_login_obrigatorio(p_valor boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.perfil_atual() is distinct from 'dono' then
    raise exception 'Só o dono pode mudar isto' using errcode = '42501';
  end if;
  update public.configuracao set exigir_login = coalesce(p_valor, false);
end;
$$;

revoke all on function equipe(), usuarios_sem_perfil(), definir_perfil(uuid, text, text, boolean),
  definir_login_obrigatorio(boolean) from public, anon;
grant execute on function equipe(), usuarios_sem_perfil(), definir_perfil(uuid, text, text, boolean),
  definir_login_obrigatorio(boolean) to authenticated;
