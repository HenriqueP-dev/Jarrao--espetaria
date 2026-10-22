  -- Fluxo principal: pedido -> setor -> andamento -> entrega -> conta.
  -- Rode este arquivo no SQL Editor do Supabase.

  create table produtos (
    id bigint generated always as identity primary key,
    nome text not null,
    preco_centavos integer not null check (preco_centavos >= 0),
    setor text not null check (setor in ('cozinha', 'churrasqueira')),
    ativo boolean not null default true
  );

  create table mesas (
    numero integer primary key
  );

  create table contas (
    id bigint generated always as identity primary key,
    mesa_numero integer not null references mesas(numero),
    status text not null default 'aberta' check (status in ('aberta', 'fechada')),
    aberta_em timestamptz not null default now()
  );
  -- No máximo uma conta aberta por mesa.
  create unique index contas_uma_aberta_por_mesa on contas (mesa_numero) where status = 'aberta';

  create table pedidos (
    id bigint generated always as identity primary key,
    conta_id bigint not null references contas(id),
    criado_em timestamptz not null default now()
  );

  -- Cada linha é um item pedido (ex.: "2 espetos de carne"), com estado próprio.
  -- Nome, preço e setor são copiados do cadastro no momento do pedido,
  -- para que mudar o cadastro depois não altere registros antigos.
  create table itens_pedido (
    id bigint generated always as identity primary key,
    pedido_id bigint not null references pedidos(id),
    conta_id bigint not null references contas(id),
    produto_id bigint not null references produtos(id),
    nome_produto text not null,
    preco_centavos integer not null,
    quantidade integer not null check (quantidade > 0),
    setor text not null,
    pessoa text,
    estado text not null default 'novo'
      check (estado in ('novo', 'em_preparo', 'pronto', 'entregue', 'cancelado')),
    criado_em timestamptz not null default now()
  );

  create table historico (
    id bigint generated always as identity primary key,
    conta_id bigint not null references contas(id),
    item_id bigint references itens_pedido(id),
    evento text not null,
    detalhe text,
    criado_em timestamptz not null default now()
  );

  -- Cria o pedido inteiro de uma vez (tudo ou nada).
  -- p_itens: [{"produto_id": 1, "quantidade": 2, "pessoa": "João"}, ...]
  create function criar_pedido(p_mesa integer, p_itens jsonb)
  returns bigint
  language plpgsql
  as $$
  declare
    v_conta bigint;
    v_pedido bigint;
    v_item jsonb;
    v_prod produtos%rowtype;
    v_item_id bigint;
  begin
    if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
      raise exception 'Pedido sem itens';
    end if;
    if not exists (select 1 from mesas where numero = p_mesa) then
      raise exception 'Mesa % não existe', p_mesa;
    end if;

    select id into v_conta from contas where mesa_numero = p_mesa and status = 'aberta';
    if v_conta is null then
      insert into contas (mesa_numero) values (p_mesa) returning id into v_conta;
      insert into historico (conta_id, evento) values (v_conta, 'conta_aberta');
    end if;

    insert into pedidos (conta_id) values (v_conta) returning id into v_pedido;

    for v_item in select * from jsonb_array_elements(p_itens) loop
      select * into v_prod from produtos
        where id = (v_item->>'produto_id')::bigint and ativo;
      if not found then
        raise exception 'Produto % não existe ou está inativo', v_item->>'produto_id';
      end if;
      if (v_item->>'quantidade')::int < 1 then
        raise exception 'Quantidade inválida';
      end if;

      insert into itens_pedido
        (pedido_id, conta_id, produto_id, nome_produto, preco_centavos, quantidade, setor, pessoa)
      values
        (v_pedido, v_conta, v_prod.id, v_prod.nome, v_prod.preco_centavos,
        (v_item->>'quantidade')::int, v_prod.setor, nullif(trim(v_item->>'pessoa'), ''))
      returning id into v_item_id;

      insert into historico (conta_id, item_id, evento, detalhe)
      values (v_conta, v_item_id, 'item_registrado',
              (v_item->>'quantidade') || 'x ' || v_prod.nome || ' -> ' || v_prod.setor);
    end loop;

    return v_pedido;
  end;
  $$;

  -- Muda o estado de um item, respeitando as transições permitidas
  -- (as mesmas de lib/estados.js).
  create function mudar_estado_item(p_item bigint, p_novo text)
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

    update itens_pedido set estado = p_novo where id = p_item;
    insert into historico (conta_id, item_id, evento, detalhe)
    values (v_item.conta_id, p_item, 'item_' || p_novo,
            v_item.quantidade || 'x ' || v_item.nome_produto);
  end;
  $$;

  -- Realtime: as telas escutam mudanças nos itens.
  alter publication supabase_realtime add table itens_pedido;

  -- PROTÓTIPO SEM LOGIN: qualquer pessoa com a chave pública pode ler e gravar.
  -- Isto precisa ser trocado por login e permissões antes de qualquer uso real.
  alter table produtos enable row level security;
  alter table mesas enable row level security;
  alter table contas enable row level security;
  alter table pedidos enable row level security;
  alter table itens_pedido enable row level security;
  alter table historico enable row level security;

  create policy proto_leitura on produtos for select using (true);
  create policy proto_leitura on mesas for select using (true);
  create policy proto_leitura on contas for select using (true);
  create policy proto_leitura on pedidos for select using (true);
  create policy proto_leitura on itens_pedido for select using (true);
  create policy proto_leitura on historico for select using (true);
  -- Gravações acontecem só pelas funções acima.
  alter function criar_pedido(integer, jsonb) security definer;
  alter function mudar_estado_item(bigint, text) security definer;
  grant execute on function criar_pedido(integer, jsonb) to anon;
  grant execute on function mudar_estado_item(bigint, text) to anon;
