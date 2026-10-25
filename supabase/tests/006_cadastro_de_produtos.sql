-- Teste do cadastro de produtos (migration 010) com as contas reais de teste (dono e garçom).
-- Tudo numa transação desfeita: produtos, pedidos e a trava ligada NÃO ficam no banco.
-- Resultado esperado: erro começando com "TESTE_OK".

do $$
declare
  u_dono uuid; u_garcom uuid;
  v_id bigint; v_ordem_max integer; v_n bigint; v_ok boolean;
  v_conta bigint; i_antigo bigint; i_novo bigint; p_skol bigint;
begin
  select id into u_dono from auth.users where email = 'dono@gmail.com';
  select id into u_garcom from auth.users where email = 'garcom@gmail.com';
  assert u_dono is not null and u_garcom is not null, 'contas de teste não encontradas';
  select id into p_skol from produtos where nome = 'Skol 600ml' and ativo;
  select max(ordem) into v_ordem_max from produtos;

  update configuracao set exigir_login = true;

  -- garçom não mexe no cardápio
  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false;
  begin perform salvar_produto(null, 'Produto Teste IA', 1234, 'garcom', 'Teste', true, false); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não pode criar produto';
  v_ok := false;
  begin perform salvar_produto(p_skol, 'Skol 600ml', 1, 'garcom', 'Cervejas 600 ml', true, false); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não pode mudar preço';
  execute 'reset role';

  -- dono cria
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_id := salvar_produto(null, '  Produto Teste IA  ', 1234, 'garcom', 'Teste', true, false);
  assert v_id is not null, 'dono deve criar produto';
  assert (select nome from produtos where id = v_id) = 'Produto Teste IA', 'o nome deve ser aparado';
  assert (select ordem from produtos where id = v_id) = v_ordem_max + 1, 'produto novo vai para o fim da ordem';
  assert (select count(*) from produtos_historico where produto_id = v_id and campo = 'criado' and usuario_nome = 'Dono') = 1,
    'a criação deve ficar no histórico com o nome do dono';

  -- validações
  v_ok := false; begin perform salvar_produto(null, 'produto teste ia', 1000, 'garcom', 'Teste', true, false); exception when others then v_ok := true; end;
  assert v_ok, 'nome repetido (sem diferenciar maiúsculas) deve ser recusado';
  v_ok := false; begin perform salvar_produto(null, 'Outro', 0, 'garcom', 'Teste', true, false); exception when others then v_ok := true; end;
  assert v_ok, 'preço zero deve ser recusado';
  v_ok := false; begin perform salvar_produto(null, 'Outro', 500001, 'garcom', 'Teste', true, false); exception when others then v_ok := true; end;
  assert v_ok, 'preço acima de R$ 5.000 deve ser recusado';
  v_ok := false; begin perform salvar_produto(null, 'Outro', 1000, 'bar', 'Teste', true, false); exception when others then v_ok := true; end;
  assert v_ok, 'setor inválido deve ser recusado';
  v_ok := false; begin perform salvar_produto(null, '   ', 1000, 'garcom', 'Teste', true, false); exception when others then v_ok := true; end;
  assert v_ok, 'nome vazio deve ser recusado';
  v_ok := false; begin perform salvar_produto(null, 'Outro', 1000, 'garcom', '', true, false); exception when others then v_ok := true; end;
  assert v_ok, 'categoria vazia deve ser recusada';
  v_ok := false; begin perform salvar_produto(-5, 'Outro', 1000, 'garcom', 'Teste', true, false); exception when others then v_ok := true; end;
  assert v_ok, 'produto inexistente deve ser recusado';
  execute 'reset role';

  -- garçom lança pedido com o preço antigo
  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform criar_pedido(919, jsonb_build_array(jsonb_build_object('produto_id', v_id, 'quantidade', 1)));
  select id into v_conta from contas where mesa_numero = 919 and status = 'aberta';
  select id into i_antigo from itens_pedido where conta_id = v_conta;
  execute 'reset role';

  -- dono muda preço, setor e nome
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform salvar_produto(v_id, 'Produto Teste IA 2', 1500, 'cozinha', 'Teste', true, false);
  assert (select count(*) from produtos_historico where produto_id = v_id and campo = 'preco_centavos' and de = '1234' and para = '1500') = 1,
    'a mudança de preço deve ficar no histórico (de 1234 para 1500)';
  assert (select count(*) from produtos_historico where produto_id = v_id and campo in ('setor', 'nome')) = 2,
    'mudanças de setor e de nome também ficam no histórico';
  assert (select count(*) from produtos_historico where produto_id = v_id) = 4, 'criado + preço + setor + nome';
  execute 'reset role';

  -- o pedido antigo não muda; o novo usa o preço novo
  assert (select preco_centavos from itens_pedido where id = i_antigo) = 1234, 'item antigo mantém o preço de quando foi pedido';
  assert (select setor from itens_pedido where id = i_antigo) = 'garcom', 'item antigo mantém o setor de quando foi pedido';
  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform criar_pedido(919, jsonb_build_array(jsonb_build_object('produto_id', v_id, 'quantidade', 1)));
  select max(id) into i_novo from itens_pedido where conta_id = v_conta;
  assert (select count(*) from produtos_historico) = 0, 'garçom não lê o histórico do cardápio';
  execute 'reset role';
  assert (select preco_centavos from itens_pedido where id = i_novo) = 1500, 'item novo usa o preço novo';
  assert (select setor from itens_pedido where id = i_novo) = 'cozinha', 'item novo usa o setor novo';

  -- desativar tira o produto da venda
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform salvar_produto(v_id, 'Produto Teste IA 2', 1500, 'cozinha', 'Teste', false, false);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false;
  begin perform criar_pedido(919, jsonb_build_array(jsonb_build_object('produto_id', v_id, 'quantidade', 1))); exception when others then v_ok := true; end;
  assert v_ok, 'produto desativado não pode ser vendido';
  execute 'reset role';

  -- sem login ninguém mexe no cardápio
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  v_ok := false;
  begin perform salvar_produto(null, 'Invasor', 100, 'garcom', 'Teste', true, false); exception when others then v_ok := true; end;
  assert v_ok, 'sem login ninguém altera o cardápio';
  execute 'reset role';

  raise exception 'TESTE_OK: cadastro do dono, validações, histórico, pedidos antigos intactos e garçom sem acesso passaram';
end $$;
