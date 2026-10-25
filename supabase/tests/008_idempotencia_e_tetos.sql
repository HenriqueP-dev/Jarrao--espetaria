-- Teste da migration 012: repetição segura de pedido e pagamento, e tetos.
-- NÃO deixa dados: termina com um erro proposital que desfaz tudo.
-- Resultado esperado: erro começando com "TESTE_OK". Qualquer outra mensagem é falha.

do $$
declare
  p_skol bigint; v_chave uuid := gen_random_uuid(); v_chave2 uuid := gen_random_uuid();
  v_ped1 bigint; v_ped2 bigint; v_conta bigint; v_ok boolean; v_n integer; v_pg uuid := gen_random_uuid();
  v_itens jsonb;
begin
  update configuracao set exigir_login = false where id = true; -- modo aberto só dentro deste teste (desfeito no fim)
  select id into p_skol from produtos where nome = 'Skol 600ml' and ativo;
  assert p_skol is not null, 'produto de teste não encontrado';
  v_itens := jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 2));

  execute 'set local role anon'; -- igual ao navegador

  -- 1. mesma chave duas vezes = um só pedido, com os itens uma vez só
  v_ped1 := criar_pedido(971, v_itens, v_chave);
  v_ped2 := criar_pedido(971, v_itens, v_chave);
  assert v_ped1 = v_ped2, 'repetição deve devolver o mesmo pedido';
  select count(*) into v_n from itens_pedido where pedido_id = v_ped1;
  assert v_n = 1, 'itens não podem duplicar na repetição';
  select count(*) into v_n from pedidos where chave = v_chave;
  assert v_n = 1, 'só um pedido com a chave';

  -- 2. chave nova = pedido novo; sem chave continua funcionando (compatível)
  assert criar_pedido(971, v_itens, v_chave2) <> v_ped1, 'chave diferente é outro pedido';
  perform criar_pedido(971, v_itens);
  perform criar_pedido(971, v_itens, null);
  select id into v_conta from contas where mesa_numero = 971 and status = 'aberta';
  select coalesce(sum(quantidade), 0) into v_n from itens_pedido where conta_id = v_conta;
  assert v_n = 8, 'esperava 4 pedidos de 2 unidades (8), veio ' || v_n;

  -- 3. tetos do pedido
  v_ok := false;
  begin perform criar_pedido(972, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 100)));
  exception when others then v_ok := sqlerrm like '%limite%'; end;
  assert v_ok, 'quantidade 100 deve ser recusada';
  v_ok := false;
  begin perform criar_pedido(972, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 2000000000)));
  exception when others then v_ok := sqlerrm like '%limite%'; end;
  assert v_ok, 'quantidade absurda deve ser recusada';
  perform criar_pedido(972, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 99)));
  v_ok := false;
  begin
    perform criar_pedido(973, (select jsonb_agg(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)) from generate_series(1, 61)));
  exception when others then v_ok := sqlerrm like '%itens demais%'; end;
  assert v_ok, 'mais de 60 linhas deve ser recusado';
  perform criar_pedido(973, (select jsonb_agg(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)) from generate_series(1, 60)));
  assert not exists (select 1 from contas where mesa_numero = 972 and status = 'aberta' and total_conta(id) < 0), 'sanidade';

  -- 4. pagamento: mesma chave duas vezes = um só pagamento
  -- (total da conta 971 = 8 x preço da Skol; paga o primeiro item com chave)
  perform registrar_pagamento(v_conta, 'dinheiro', 100, v_pg);
  perform registrar_pagamento(v_conta, 'dinheiro', 100, v_pg);
  select count(*) into v_n from pagamentos where conta_id = v_conta;
  assert v_n = 1, 'pagamento repetido com a mesma chave não pode duplicar';
  select count(*) into v_n from historico where conta_id = v_conta and evento = 'pagamento_registrado';
  assert v_n = 1, 'histórico do pagamento também uma vez só';
  perform registrar_pagamento(v_conta, 'dinheiro', 100, gen_random_uuid());
  perform registrar_pagamento(v_conta, 'dinheiro', 100); -- sem chave, como antes
  select count(*) into v_n from pagamentos where conta_id = v_conta;
  assert v_n = 3, 'chaves diferentes ou ausentes registram pagamentos distintos';

  -- 5. teto do valor do pagamento e regras antigas continuam valendo
  v_ok := false;
  begin perform registrar_pagamento(v_conta, 'dinheiro', 5000001); exception when others then v_ok := sqlerrm like '%limite%'; end;
  assert v_ok, 'pagamento acima de R$ 50.000 deve ser recusado';
  v_ok := false;
  begin perform registrar_pagamento(v_conta, 'dinheiro', 99999999); exception when others then v_ok := true; end;
  assert v_ok, 'pagamento acima do saldo continua recusado';

  raise exception 'TESTE_OK idempotência e tetos';
end $$;
