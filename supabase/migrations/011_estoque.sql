-- Migration 011: estoque de bebidas e espetos (primeira versão).
-- HIPÓTESES (ver docs/DECISOES.md, seção E), a confirmar com o dono:
--  - O dono escolhe quais produtos têm estoque controlado e o mínimo para avisar.
--  - Entradas podem ser por unidade ou por embalagem (ex.: 3 caixas de 15 = 45 unidades).
--  - Cada item lançado num pedido baixa o estoque sozinho (feito no banco, em qualquer caminho).
--  - Cancelar um item ainda "novo" devolve ao estoque; depois de iniciar o preparo, não devolve
--    (o espeto pode ter sido reaproveitado ou perdido: o caixa lança a perda à mão, se quiser).
--  - O estoque NUNCA bloqueia uma venda; o saldo pode ficar negativo e aparece como alerta.
--  - Perda, consumo interno e contagem (inventário) são lançados à mão por caixa ou dono.
--  - Doses e receitas ficam de fora (falta definir fichas técnicas).

alter table produtos add column controla_estoque boolean not null default false;
alter table produtos add column estoque_minimo integer not null default 0
  check (estoque_minimo between 0 and 100000);

create table produto_embalagens (
  id bigint generated always as identity primary key,
  produto_id bigint not null references produtos (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 30),
  unidades integer not null check (unidades between 2 and 1000),
  unique (produto_id, nome)
);

create table estoque_movimentos (
  id bigint generated always as identity primary key,
  produto_id bigint not null references produtos (id),
  tipo text not null check (tipo in ('entrada', 'venda', 'estorno', 'perda', 'consumo_interno', 'ajuste')),
  quantidade integer not null check (quantidade <> 0), -- em unidades; negativo = saída
  detalhe text check (char_length(detalhe) <= 200),
  item_id bigint references itens_pedido (id),
  usuario_id uuid,
  usuario_nome text,
  criado_em timestamptz not null default now(),
  check (
    (tipo in ('entrada', 'estorno') and quantidade > 0)
    or (tipo in ('venda', 'perda', 'consumo_interno') and quantidade < 0)
    or tipo = 'ajuste'
  )
);
create index estoque_movimentos_produto_idx on estoque_movimentos (produto_id, criado_em desc);
create index estoque_movimentos_item_idx on estoque_movimentos (item_id);

alter table produto_embalagens enable row level security;
alter table estoque_movimentos enable row level security;
grant select on produto_embalagens, estoque_movimentos to anon, authenticated;
create policy leitura_caixa on produto_embalagens for select using ((select private.acesso_caixa()));
create policy leitura_caixa on estoque_movimentos for select using ((select private.acesso_caixa()));

-- Saldo de cada produto controlado (soma dos movimentos). Respeita as regras de leitura de quem consulta.
create view estoque_saldos with (security_invoker = true) as
select p.id as produto_id,
       p.nome,
       p.categoria,
       p.setor,
       p.estoque_minimo,
       coalesce(sum(m.quantidade), 0)::integer as saldo
from produtos p
left join estoque_movimentos m on m.produto_id = p.id
where p.controla_estoque and (select private.acesso_caixa())
group by p.id;
grant select on estoque_saldos to anon, authenticated;

-- Autor de cada movimento (mesma ideia do histórico das contas)
create function private.preencher_autor_estoque()
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
revoke all on function private.preencher_autor_estoque() from public;
create trigger estoque_autor before insert on estoque_movimentos
  for each row execute function private.preencher_autor_estoque();

-- Baixa automática: todo item lançado de um produto controlado tira do estoque.
create function private.baixar_estoque_do_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.produtos p where p.id = new.produto_id and p.controla_estoque) then
    insert into public.estoque_movimentos (produto_id, tipo, quantidade, detalhe, item_id)
    values (new.produto_id, 'venda', -new.quantidade,
            'Mesa ' || (select c.mesa_numero from public.contas c where c.id = new.conta_id), new.id);
  end if;
  return null;
end;
$$;
revoke all on function private.baixar_estoque_do_item() from public;
create trigger estoque_baixa after insert on itens_pedido
  for each row execute function private.baixar_estoque_do_item();

-- Devolve ao estoque só quando o item ainda estava "novo" (nada foi feito com ele).
create function private.estornar_estoque_do_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'cancelado' and old.estado = 'novo'
     and exists (select 1 from public.estoque_movimentos m where m.item_id = new.id and m.tipo = 'venda')
     and not exists (select 1 from public.estoque_movimentos m where m.item_id = new.id and m.tipo = 'estorno') then
    insert into public.estoque_movimentos (produto_id, tipo, quantidade, detalhe, item_id)
    values (new.produto_id, 'estorno', new.quantidade, 'Item cancelado antes do preparo', new.id);
  end if;
  return null;
end;
$$;
revoke all on function private.estornar_estoque_do_item() from public;
create trigger estoque_estorno after update of estado on itens_pedido
  for each row execute function private.estornar_estoque_do_item();

-- O histórico do cardápio também anota mudanças do controle de estoque.
create or replace function private.registrar_mudanca_produto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_nome text := (select p.nome from public.perfis p where p.user_id = (select auth.uid()));
begin
  if tg_op = 'INSERT' then
    insert into public.produtos_historico (produto_id, campo, de, para, usuario_id, usuario_nome)
    values (new.id, 'criado', null, new.nome, v_uid, v_nome);
    return null;
  end if;

  if new.nome is distinct from old.nome then
    insert into public.produtos_historico (produto_id, campo, de, para, usuario_id, usuario_nome)
    values (new.id, 'nome', old.nome, new.nome, v_uid, v_nome);
  end if;
  if new.preco_centavos is distinct from old.preco_centavos then
    insert into public.produtos_historico (produto_id, campo, de, para, usuario_id, usuario_nome)
    values (new.id, 'preco_centavos', old.preco_centavos::text, new.preco_centavos::text, v_uid, v_nome);
  end if;
  if new.setor is distinct from old.setor then
    insert into public.produtos_historico (produto_id, campo, de, para, usuario_id, usuario_nome)
    values (new.id, 'setor', old.setor, new.setor, v_uid, v_nome);
  end if;
  if new.categoria is distinct from old.categoria then
    insert into public.produtos_historico (produto_id, campo, de, para, usuario_id, usuario_nome)
    values (new.id, 'categoria', old.categoria, new.categoria, v_uid, v_nome);
  end if;
  if new.ativo is distinct from old.ativo then
    insert into public.produtos_historico (produto_id, campo, de, para, usuario_id, usuario_nome)
    values (new.id, 'ativo', old.ativo::text, new.ativo::text, v_uid, v_nome);
  end if;
  if new.exige_espeto is distinct from old.exige_espeto then
    insert into public.produtos_historico (produto_id, campo, de, para, usuario_id, usuario_nome)
    values (new.id, 'exige_espeto', old.exige_espeto::text, new.exige_espeto::text, v_uid, v_nome);
  end if;
  if new.controla_estoque is distinct from old.controla_estoque then
    insert into public.produtos_historico (produto_id, campo, de, para, usuario_id, usuario_nome)
    values (new.id, 'controla_estoque', old.controla_estoque::text, new.controla_estoque::text, v_uid, v_nome);
  end if;
  if new.estoque_minimo is distinct from old.estoque_minimo then
    insert into public.produtos_historico (produto_id, campo, de, para, usuario_id, usuario_nome)
    values (new.id, 'estoque_minimo', old.estoque_minimo::text, new.estoque_minimo::text, v_uid, v_nome);
  end if;
  return null;
end;
$$;

-- Configuração (só o dono; vale mesmo com a trava do login desligada) ---------------------
create function definir_controle_estoque(p_produto bigint, p_controla boolean, p_minimo integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.perfil_atual() is distinct from 'dono' then
    raise exception 'Só o dono escolhe o que tem estoque' using errcode = '42501';
  end if;
  if p_minimo is null or p_minimo < 0 or p_minimo > 100000 then
    raise exception 'O estoque mínimo deve ficar entre 0 e 100000';
  end if;
  update produtos
     set controla_estoque = coalesce(p_controla, false), estoque_minimo = p_minimo
   where id = p_produto;
  if not found then
    raise exception 'Produto não encontrado';
  end if;
end;
$$;

create function salvar_embalagem(p_produto bigint, p_nome text, p_unidades integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := btrim(p_nome);
begin
  if private.perfil_atual() is distinct from 'dono' then
    raise exception 'Só o dono cadastra embalagens' using errcode = '42501';
  end if;
  if v_nome is null or char_length(v_nome) not between 1 and 30 then
    raise exception 'O nome da embalagem deve ter de 1 a 30 letras';
  end if;
  if p_unidades is null or p_unidades < 2 or p_unidades > 1000 then
    raise exception 'A embalagem deve ter de 2 a 1000 unidades';
  end if;
  if not exists (select 1 from produtos where id = p_produto) then
    raise exception 'Produto não encontrado';
  end if;
  insert into produto_embalagens (produto_id, nome, unidades)
  values (p_produto, v_nome, p_unidades)
  on conflict (produto_id, nome) do update set unidades = excluded.unidades;
end;
$$;

create function remover_embalagem(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.perfil_atual() is distinct from 'dono' then
    raise exception 'Só o dono remove embalagens' using errcode = '42501';
  end if;
  -- As entradas já lançadas guardam as unidades, então nada do histórico muda.
  delete from produto_embalagens where id = p_id;
end;
$$;

-- Lançamentos do dia a dia (caixa e dono) -------------------------------------------------
create function registrar_entrada_estoque(
  p_produto bigint, p_quantidade integer, p_embalagem bigint default null, p_detalhe text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod produtos%rowtype;
  v_emb produto_embalagens%rowtype;
  v_unidades integer;
  v_detalhe text := nullif(btrim(p_detalhe), '');
begin
  perform private.exigir_perfil(array['caixa', 'dono']);
  select * into v_prod from produtos where id = p_produto for update;
  if not found then
    raise exception 'Produto não encontrado';
  end if;
  if not v_prod.controla_estoque then
    raise exception '% não tem estoque controlado', v_prod.nome;
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 100000 then
    raise exception 'A quantidade deve ficar entre 1 e 100000';
  end if;

  if p_embalagem is null then
    v_unidades := p_quantidade;
  else
    select * into v_emb from produto_embalagens where id = p_embalagem and produto_id = p_produto;
    if not found then
      raise exception 'Embalagem não encontrada para este produto';
    end if;
    v_unidades := p_quantidade * v_emb.unidades;
    v_detalhe := concat_ws(' - ', p_quantidade || ' ' || v_emb.nome || ' de ' || v_emb.unidades, v_detalhe);
  end if;
  if v_unidades > 1000000 then
    raise exception 'Quantidade grande demais';
  end if;

  insert into estoque_movimentos (produto_id, tipo, quantidade, detalhe)
  values (p_produto, 'entrada', v_unidades, left(v_detalhe, 200));
end;
$$;

create function registrar_saida_estoque(p_produto bigint, p_tipo text, p_quantidade integer, p_detalhe text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod produtos%rowtype;
begin
  perform private.exigir_perfil(array['caixa', 'dono']);
  if p_tipo not in ('perda', 'consumo_interno') then
    raise exception 'Tipo de saída inválido';
  end if;
  select * into v_prod from produtos where id = p_produto for update;
  if not found then
    raise exception 'Produto não encontrado';
  end if;
  if not v_prod.controla_estoque then
    raise exception '% não tem estoque controlado', v_prod.nome;
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 100000 then
    raise exception 'A quantidade deve ficar entre 1 e 100000';
  end if;
  insert into estoque_movimentos (produto_id, tipo, quantidade, detalhe)
  values (p_produto, p_tipo, -p_quantidade, left(nullif(btrim(p_detalhe), ''), 200));
end;
$$;

-- Inventário: o caixa conta o que existe e o sistema lança a diferença como ajuste.
create function registrar_contagem_estoque(p_produto bigint, p_contado integer, p_detalhe text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod produtos%rowtype;
  v_saldo integer;
  v_dif integer;
begin
  perform private.exigir_perfil(array['caixa', 'dono']);
  select * into v_prod from produtos where id = p_produto for update;
  if not found then
    raise exception 'Produto não encontrado';
  end if;
  if not v_prod.controla_estoque then
    raise exception '% não tem estoque controlado', v_prod.nome;
  end if;
  if p_contado is null or p_contado < 0 or p_contado > 1000000 then
    raise exception 'A contagem deve ficar entre 0 e 1000000';
  end if;
  select coalesce(sum(quantidade), 0) into v_saldo from estoque_movimentos where produto_id = p_produto;
  v_dif := p_contado - v_saldo;
  if v_dif = 0 then
    return; -- a contagem bate com o sistema
  end if;
  insert into estoque_movimentos (produto_id, tipo, quantidade, detalhe)
  values (p_produto, 'ajuste', v_dif,
          left(concat_ws(' - ', 'Contagem: ' || p_contado || ' (sistema tinha ' || v_saldo || ')', nullif(btrim(p_detalhe), '')), 200));
end;
$$;

revoke all on function definir_controle_estoque(bigint, boolean, integer),
  salvar_embalagem(bigint, text, integer), remover_embalagem(bigint) from public, anon;
grant execute on function definir_controle_estoque(bigint, boolean, integer),
  salvar_embalagem(bigint, text, integer), remover_embalagem(bigint) to authenticated;

-- Os lançamentos passam pelo porteiro de perfis; com a trava desligada funcionam sem login, como o resto.
grant execute on function registrar_entrada_estoque(bigint, integer, bigint, text),
  registrar_saida_estoque(bigint, text, integer, text),
  registrar_contagem_estoque(bigint, integer, text) to anon, authenticated;
