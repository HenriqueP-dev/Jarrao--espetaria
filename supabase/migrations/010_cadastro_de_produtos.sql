-- Migration 010: cadastro de produtos pelo dono, com histórico de mudanças.
-- HIPÓTESE (ver docs/DECISOES.md, D2): só o dono cria, edita preço/setor e desativa produto.
-- Vale SEMPRE (mesmo com a trava do login desligada): mexer no cardápio exige um dono logado.
-- Pedidos antigos não mudam: o nome, o preço e o setor são copiados para o item no pedido.

create table produtos_historico (
  id bigint generated always as identity primary key,
  produto_id bigint not null references produtos (id),
  campo text not null, -- criado, nome, preco_centavos, setor, categoria, ativo, exige_espeto
  de text,
  para text,
  usuario_id uuid,
  usuario_nome text,
  criado_em timestamptz not null default now()
);
create index produtos_historico_produto_idx on produtos_historico (produto_id, criado_em desc);

alter table produtos_historico enable row level security;
grant select on produtos_historico to authenticated;
create policy leitura_dono on produtos_historico for select to authenticated
  using ((select private.perfil_atual()) = 'dono');

-- Anota cada mudança do cadastro (quem fez, o que era e o que ficou).
create function private.registrar_mudanca_produto()
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
  return null;
end;
$$;

revoke all on function private.registrar_mudanca_produto() from public;

create trigger produtos_auditoria
  after insert or update on produtos
  for each row execute function private.registrar_mudanca_produto();

-- Cria (p_id nulo) ou edita um produto. Devolve o id.
create function salvar_produto(
  p_id bigint,
  p_nome text,
  p_preco_centavos integer,
  p_setor text,
  p_categoria text,
  p_ativo boolean,
  p_exige_espeto boolean
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := btrim(p_nome);
  v_cat text := btrim(p_categoria);
  v_id bigint;
begin
  if private.perfil_atual() is distinct from 'dono' then
    raise exception 'Só o dono altera o cardápio' using errcode = '42501';
  end if;
  if v_nome is null or char_length(v_nome) not between 1 and 80 then
    raise exception 'O nome deve ter de 1 a 80 letras';
  end if;
  if p_preco_centavos is null or p_preco_centavos < 1 or p_preco_centavos > 500000 then
    raise exception 'O preço deve ficar entre R$ 0,01 e R$ 5.000,00';
  end if;
  if p_setor is null or p_setor not in ('cozinha', 'churrasqueira', 'garcom') then
    raise exception 'Setor inválido';
  end if;
  if v_cat is null or char_length(v_cat) not between 1 and 60 then
    raise exception 'A categoria deve ter de 1 a 60 letras';
  end if;
  if exists (select 1 from produtos where lower(nome) = lower(v_nome) and id is distinct from p_id) then
    raise exception 'Já existe um produto com o nome %', v_nome;
  end if;

  if p_id is null then
    insert into produtos (nome, preco_centavos, setor, categoria, ordem, ativo, exige_espeto)
    values (v_nome, p_preco_centavos, p_setor, v_cat,
            coalesce((select max(ordem) from produtos), 0) + 1,
            coalesce(p_ativo, true), coalesce(p_exige_espeto, false))
    returning id into v_id;
  else
    update produtos
       set nome = v_nome,
           preco_centavos = p_preco_centavos,
           setor = p_setor,
           categoria = v_cat,
           ativo = coalesce(p_ativo, ativo),
           exige_espeto = coalesce(p_exige_espeto, exige_espeto)
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Produto não encontrado';
    end if;
  end if;
  return v_id;
end;
$$;

revoke all on function salvar_produto(bigint, text, integer, text, text, boolean, boolean) from public, anon;
grant execute on function salvar_produto(bigint, text, integer, text, text, boolean, boolean) to authenticated;
