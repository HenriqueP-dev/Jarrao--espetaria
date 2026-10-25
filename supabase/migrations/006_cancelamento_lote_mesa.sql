-- Migration 006: cancelamento visível ao setor, mudanças em lote atômicas,
-- troca de mesa e mover item entre pessoas. Só adiciona coisas; não apaga dados.
-- HIPÓTESES (ver docs/DECISOES.md): "Ciente" confirma o cancelamento; troca de
-- mesa só para mesa sem conta aberta.

-- 1. Cancelamento: o setor marca "Ciente" quando viu ----------------------------
alter table itens_pedido add column cancelamento_visto_em timestamptz;

create function confirmar_cancelamento(p_item bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v itens_pedido%rowtype;
begin
  select * into v from itens_pedido where id = p_item for update;
  if not found then
    raise exception 'Item não encontrado';
  end if;
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

-- 2. Mudar vários itens de uma vez, tudo ou nada --------------------------------
-- Usa as mesmas regras de mudar_estado_item. Se um item falhar, nenhum muda.
create function mudar_estado_itens(p_itens bigint[], p_novo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_itens is null or cardinality(p_itens) = 0 then
    raise exception 'Nenhum item informado';
  end if;
  foreach v_id in array p_itens loop
    perform mudar_estado_item(v_id, p_novo);
  end loop;
end;
$$;

-- 3. Trocar a conta de mesa -----------------------------------------------------
create function trocar_mesa(p_conta bigint, p_mesa integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v contas%rowtype;
begin
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

-- 4. Mover um item para outra pessoa da mesma conta -----------------------------
create function mudar_pessoa_item(p_item bigint, p_pessoa text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v itens_pedido%rowtype;
  v_nova text := nullif(trim(p_pessoa), '');
begin
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

-- 5. Limites de tamanho dos textos livres ---------------------------------------
alter table itens_pedido add constraint itens_pessoa_tamanho check (char_length(pessoa) <= 60);
alter table itens_pedido add constraint itens_detalhe_tamanho check (char_length(detalhe) <= 200);

-- Permissões (protótipo sem login; trocar por regras por perfil na etapa de login)
grant execute on function confirmar_cancelamento(bigint) to anon;
grant execute on function mudar_estado_itens(bigint[], text) to anon;
grant execute on function trocar_mesa(bigint, integer) to anon;
grant execute on function mudar_pessoa_item(bigint, text) to anon;
