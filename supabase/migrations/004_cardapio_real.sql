-- Cardápio real, categorias, observação por item e setor 'garcom'.
-- Rode DEPOIS da 003 no SQL Editor do Supabase.
-- Preços informados pelo desenvolvedor (docs/CARDAPIO.md); NÃO confirmados pelo dono.
-- Gerado a partir de uma lista; 133 produtos.

-- 1. Colunas novas ---------------------------------------------------------
alter table produtos add column categoria text;
alter table produtos add column ordem integer not null default 0;
-- Jantinha: o garçom precisa escolher qual espeto da casa vai no prato.
alter table produtos add column exige_espeto boolean not null default false;
-- Observação opcional do item (ex.: "Espeto: Carne", "no espeto de frango").
alter table itens_pedido add column detalhe text;

-- 2. Setor 'garcom' (bebidas: o próprio garçom anota e busca) --------------
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'produtos'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%setor%'
  loop
    execute format('alter table produtos drop constraint %I', c.conname);
  end loop;
end;
$$;
alter table produtos
  add constraint produtos_setor_check check (setor in ('cozinha', 'churrasqueira', 'garcom'));

-- 3. Desativa os produtos fictícios (não apaga: o histórico de testes continua) --
update produtos set ativo = false where categoria is null;

-- 4. Cardápio real ---------------------------------------------------------
insert into produtos (nome, preco_centavos, setor, categoria, ordem, exige_espeto) values
  ('Jantinha Simples', 2500, 'churrasqueira', 'Jantinhas', 1, true),
  ('Jantinha Completa', 2700, 'churrasqueira', 'Jantinhas', 2, true),
  ('Mandioca na Manteiga 250g', 900, 'churrasqueira', 'Adicionais da jantinha', 3, false),
  ('Mandioca na Manteiga 500g', 1800, 'churrasqueira', 'Adicionais da jantinha', 4, false),
  ('Mandioca Pedaço 250g', 900, 'churrasqueira', 'Adicionais da jantinha', 5, false),
  ('Mandioca Pedaço 500g', 1800, 'churrasqueira', 'Adicionais da jantinha', 6, false),
  ('Porção de Arroz 300g', 1100, 'churrasqueira', 'Adicionais da jantinha', 7, false),
  ('Porção de Feijão 200g', 1100, 'churrasqueira', 'Adicionais da jantinha', 8, false),
  ('Pote 100ml Molho Vermelho', 700, 'churrasqueira', 'Adicionais da jantinha', 9, false),
  ('Vinagrete 200g', 700, 'churrasqueira', 'Adicionais da jantinha', 10, false),
  ('Salada Alface, Tomate, Cebola e Azeitonas (meia)', 1900, 'cozinha', 'Saladas', 11, false),
  ('Salada Alface, Tomate, Cebola e Azeitonas (inteira)', 3500, 'cozinha', 'Saladas', 12, false),
  ('Carne', 1000, 'churrasqueira', 'Espetos da casa', 13, false),
  ('Carne Pimenta e Cebola', 1100, 'churrasqueira', 'Espetos da casa', 14, false),
  ('Coração', 1000, 'churrasqueira', 'Espetos da casa', 15, false),
  ('Panceta com Pernil', 1000, 'churrasqueira', 'Espetos da casa', 16, false),
  ('Frango', 900, 'churrasqueira', 'Espetos da casa', 17, false),
  ('Coxa Desossada', 1000, 'churrasqueira', 'Espetos da casa', 18, false),
  ('Tulipa', 900, 'churrasqueira', 'Espetos da casa', 19, false),
  ('Pão de Alho', 900, 'churrasqueira', 'Espetos da casa', 20, false),
  ('Linguiça Toscana', 1100, 'churrasqueira', 'Espetos da casa', 21, false),
  ('Linguiça Cabo de Rei', 900, 'churrasqueira', 'Espetos da casa', 22, false),
  ('Linguiça Apimentada', 1000, 'churrasqueira', 'Espetos da casa', 23, false),
  ('Kafta', 800, 'churrasqueira', 'Espetos da casa', 24, false),
  ('Kafta Queijo', 800, 'churrasqueira', 'Espetos da casa', 25, false),
  ('Kafta, Rúcula e Queijo', 800, 'churrasqueira', 'Espetos da casa', 26, false),
  ('Kafta, Quibe e Queijo', 800, 'churrasqueira', 'Espetos da casa', 27, false),
  ('Kafta, Cabotiá com Bacon', 800, 'churrasqueira', 'Espetos da casa', 28, false),
  ('Kafta Carne Seca c/ Mandioca', 800, 'churrasqueira', 'Espetos da casa', 29, false),
  ('Kafta de Frango c/ Queijo', 800, 'churrasqueira', 'Espetos da casa', 30, false),
  ('Queijo', 1100, 'churrasqueira', 'Espetos da casa', 31, false),
  ('Provolone', 1100, 'churrasqueira', 'Espetos da casa', 32, false),
  ('Coalho', 1100, 'churrasqueira', 'Espetos da casa', 33, false),
  ('Medalhão Quiabo', 1100, 'churrasqueira', 'Espetos da casa', 34, false),
  ('Medalhão de Tilápia', 1200, 'churrasqueira', 'Espetos especiais', 35, false),
  ('Medalhão de Frango', 1200, 'churrasqueira', 'Espetos especiais', 36, false),
  ('Medalhão de Queijo', 1200, 'churrasqueira', 'Espetos especiais', 37, false),
  ('Medalhão de Provolone', 1200, 'churrasqueira', 'Espetos especiais', 38, false),
  ('Medalhão de Mandioca', 1000, 'churrasqueira', 'Espetos especiais', 39, false),
  ('Misto (carne, calabresa defumada, bacon e cebola roxa)', 1600, 'churrasqueira', 'Espetos especiais', 40, false),
  ('Cupim Grill', 1300, 'churrasqueira', 'Espetos especiais', 41, false),
  ('Carneiro', 1500, 'churrasqueira', 'Espetos especiais', 42, false),
  ('Linguiça, Rúcula e Queijo', 1400, 'churrasqueira', 'Espetos especiais', 43, false),
  ('Picanha Suína', 1000, 'churrasqueira', 'Espetos especiais', 44, false),
  ('Linguiça Cuiabana de Carne', 1300, 'churrasqueira', 'Espetos especiais', 45, false),
  ('Linguiça Cuiabana de Frango', 1300, 'churrasqueira', 'Espetos especiais', 46, false),
  ('Costela', 1200, 'churrasqueira', 'Espetos especiais', 47, false),
  ('Medalhão Romeu e Julieta', 1200, 'churrasqueira', 'Doces', 48, false),
  ('Medalhão Coalho Melaço', 1200, 'churrasqueira', 'Doces', 49, false),
  ('Catupiry c/ Alho Frito', 600, 'churrasqueira', 'Adicionais dos espetos', 50, false),
  ('Cheddar c/ Alho Frito', 600, 'churrasqueira', 'Adicionais dos espetos', 51, false),
  ('Catupiry c/ Cebola Crispy', 600, 'churrasqueira', 'Adicionais dos espetos', 52, false),
  ('Cheddar c/ Cebola Crispy', 600, 'churrasqueira', 'Adicionais dos espetos', 53, false),
  ('Quibe Carne', 1050, 'cozinha', 'Quibes', 54, false),
  ('Quibe Queijo', 1050, 'cozinha', 'Quibes', 55, false),
  ('Quibe Carne c/ Catupiry', 1050, 'cozinha', 'Quibes', 56, false),
  ('Quibe Queijo c/ Catupiry', 1050, 'cozinha', 'Quibes', 57, false),
  ('Quibe Carne c/ Cheddar', 1050, 'cozinha', 'Quibes', 58, false),
  ('Quibe Queijo c/ Cheddar', 1050, 'cozinha', 'Quibes', 59, false),
  ('Batata Simples (meia)', 3500, 'cozinha', 'Porções', 60, false),
  ('Batata Simples (inteira)', 5500, 'cozinha', 'Porções', 61, false),
  ('Batata Completa Catupiry e Bacon (meia)', 3500, 'cozinha', 'Porções', 62, false),
  ('Batata Completa Catupiry e Bacon (inteira)', 5600, 'cozinha', 'Porções', 63, false),
  ('Kibe Cru', 1500, 'cozinha', 'Porções', 64, false),
  ('Calabresa Acebolada (meia)', 4500, 'cozinha', 'Porções', 65, false),
  ('Calabresa Acebolada (inteira)', 5500, 'cozinha', 'Porções', 66, false),
  ('Amendoim (inteiro)', 600, 'cozinha', 'Porções', 67, false),
  ('Caipirinha de Limão', 2500, 'cozinha', 'Drinks da casa', 68, false),
  ('Caipirinha de Maracujá', 2500, 'cozinha', 'Drinks da casa', 69, false),
  ('Caipirinha de Morango', 2500, 'cozinha', 'Drinks da casa', 70, false),
  ('Caipirinha de Kiwi', 2500, 'cozinha', 'Drinks da casa', 71, false),
  ('Caipirinha de Abacaxi', 2500, 'cozinha', 'Drinks da casa', 72, false),
  ('Caipiroska de Limão', 2500, 'cozinha', 'Drinks da casa', 73, false),
  ('Caipiroska de Maracujá', 2500, 'cozinha', 'Drinks da casa', 74, false),
  ('Caipiroska de Morango', 2500, 'cozinha', 'Drinks da casa', 75, false),
  ('Caipiroska de Kiwi', 2500, 'cozinha', 'Drinks da casa', 76, false),
  ('Caipiroska de Abacaxi', 2500, 'cozinha', 'Drinks da casa', 77, false),
  ('Saqueirinha de Limão', 2500, 'cozinha', 'Drinks da casa', 78, false),
  ('Saqueirinha de Maracujá', 2500, 'cozinha', 'Drinks da casa', 79, false),
  ('Saqueirinha de Morango', 2500, 'cozinha', 'Drinks da casa', 80, false),
  ('Saqueirinha de Kiwi', 2500, 'cozinha', 'Drinks da casa', 81, false),
  ('Saqueirinha de Abacaxi', 2500, 'cozinha', 'Drinks da casa', 82, false),
  ('Antarctica Boa 600ml', 1400, 'garcom', 'Cervejas 600 ml', 83, false),
  ('Skol 600ml', 1400, 'garcom', 'Cervejas 600 ml', 84, false),
  ('Brahma 600ml', 1400, 'garcom', 'Cervejas 600 ml', 85, false),
  ('Antarctica Subzero 600ml', 1400, 'garcom', 'Cervejas 600 ml', 86, false),
  ('Petra 600ml', 1400, 'garcom', 'Cervejas 600 ml', 87, false),
  ('Império 600ml', 1400, 'garcom', 'Cervejas 600 ml', 88, false),
  ('Original 600ml', 1600, 'garcom', 'Cervejas 600 ml', 89, false),
  ('Heineken 600ml', 1800, 'garcom', 'Cervejas 600 ml', 90, false),
  ('Gold 600ml', 1500, 'garcom', 'Cervejas 600 ml', 91, false),
  ('Antarctica Boa Long Neck/Lata 350ml', 700, 'garcom', 'Cervejas long neck e lata', 92, false),
  ('Skol Long Neck/Lata 350ml', 700, 'garcom', 'Cervejas long neck e lata', 93, false),
  ('Brahma Long Neck/Lata 350ml', 700, 'garcom', 'Cervejas long neck e lata', 94, false),
  ('Antarctica Subzero Long Neck/Lata 350ml', 700, 'garcom', 'Cervejas long neck e lata', 95, false),
  ('Petra Long Neck/Lata 350ml', 700, 'garcom', 'Cervejas long neck e lata', 96, false),
  ('Cristal Long Neck/Lata 350ml', 450, 'garcom', 'Cervejas long neck e lata', 97, false),
  ('Amstel Long Neck/Lata 350ml', 700, 'garcom', 'Cervejas long neck e lata', 98, false),
  ('Heineken Long Neck/Lata 350ml', 1000, 'garcom', 'Cervejas long neck e lata', 99, false),
  ('Heineken 0% Long Neck/Lata 350ml', 1000, 'garcom', 'Cervejas long neck e lata', 100, false),
  ('Guaraná 2L', 1000, 'garcom', 'Refrigerantes grandes', 101, false),
  ('Coca-Cola 1L', 1000, 'garcom', 'Refrigerantes grandes', 102, false),
  ('Guaraná Antarctica 1L', 1000, 'garcom', 'Refrigerantes grandes', 103, false),
  ('Coca-Cola 1L Descartável', 1000, 'garcom', 'Refrigerantes grandes', 104, false),
  ('Guaraná Antarctica 1L Descartável', 1000, 'garcom', 'Refrigerantes grandes', 105, false),
  ('Poty 2L', 1500, 'garcom', 'Refrigerantes grandes', 106, false),
  ('Coca-Cola 2L', 1500, 'garcom', 'Refrigerantes grandes', 107, false),
  ('Coca-Cola Zero 2L', 1500, 'garcom', 'Refrigerantes grandes', 108, false),
  ('Coca-Cola 350ml', 700, 'garcom', 'Refrigerantes, águas e sucos', 109, false),
  ('Coca-Cola Zero 350ml', 700, 'garcom', 'Refrigerantes, águas e sucos', 110, false),
  ('Guaraná Antarctica 350ml', 700, 'garcom', 'Refrigerantes, águas e sucos', 111, false),
  ('Fanta Uva 350ml', 700, 'garcom', 'Refrigerantes, águas e sucos', 112, false),
  ('Fanta Laranja 350ml', 700, 'garcom', 'Refrigerantes, águas e sucos', 113, false),
  ('Sprite 350ml', 700, 'garcom', 'Refrigerantes, águas e sucos', 114, false),
  ('Schweppes Citrus 350ml', 700, 'garcom', 'Refrigerantes, águas e sucos', 115, false),
  ('Tônica Antarctica 350ml', 700, 'garcom', 'Refrigerantes, águas e sucos', 116, false),
  ('H2OH! 350ml', 700, 'garcom', 'Refrigerantes, águas e sucos', 117, false),
  ('Água', 450, 'garcom', 'Refrigerantes, águas e sucos', 118, false),
  ('Água com Gás', 500, 'garcom', 'Refrigerantes, águas e sucos', 119, false),
  ('Suco de Laranja', 1000, 'garcom', 'Refrigerantes, águas e sucos', 120, false),
  ('Suco Tamarindo', 1000, 'garcom', 'Refrigerantes, águas e sucos', 121, false),
  ('Garrafa de Vinho Tinto / Suave 750ml', 3000, 'garcom', 'Doses e outras bebidas', 122, false),
  ('Energético TNT', 1500, 'garcom', 'Doses e outras bebidas', 123, false),
  ('Cabaré Fire', 900, 'garcom', 'Doses e outras bebidas', 124, false),
  ('Cabaré Ouro', 900, 'garcom', 'Doses e outras bebidas', 125, false),
  ('Velho Barreiro', 600, 'garcom', 'Doses e outras bebidas', 126, false),
  ('51', 500, 'garcom', 'Doses e outras bebidas', 127, false),
  ('Conhaque', 600, 'garcom', 'Doses e outras bebidas', 128, false),
  ('Martini Bianco', 800, 'garcom', 'Doses e outras bebidas', 129, false),
  ('Campari', 1000, 'garcom', 'Doses e outras bebidas', 130, false),
  ('Vodka', 800, 'garcom', 'Doses e outras bebidas', 131, false),
  ('Bacardi', 900, 'garcom', 'Doses e outras bebidas', 132, false),
  ('Whisky', 2500, 'garcom', 'Doses e outras bebidas', 133, false);

-- 5. Funções atualizadas ---------------------------------------------------
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
  if not exists (select 1 from mesas where numero = p_mesa) then
    raise exception 'Mesa % não existe', p_mesa;
  end if;

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

-- Itens do setor 'garcom' (bebidas) não passam por preparo: vão de Novo direto
-- para Entregue (ou Cancelado). Mantenha igual a lib/estados.js.
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

grant execute on function criar_pedido(integer, jsonb) to anon;
grant execute on function mudar_estado_item(bigint, text) to anon;
