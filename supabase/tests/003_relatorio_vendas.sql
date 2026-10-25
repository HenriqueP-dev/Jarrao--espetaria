-- Teste de relatorio_vendas (migration 007): compara o relatório antes e depois de uma
-- venda criada dentro do teste. NÃO deixa dados (termina com um erro proposital).
-- Resultado esperado: erro começando com "TESTE_OK".

do $$
declare
  u_teste uuid := gen_random_uuid(); -- dono temporário (desfeito no fim)
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  antes jsonb; depois jsonb;
  p_skol bigint; p_carne bigint;
  v_conta bigint; i_skol bigint; i_carne bigint; v_total bigint; v_ok boolean;
  v_qtd_skol_antes bigint; v_qtd_skol_depois bigint;
begin
  -- desde a migration 013 não existe modo aberto: o teste usa um dono temporário, logado
  insert into auth.users (id, email, aud, role, instance_id)
  values (u_teste, u_teste::text || '@teste.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into perfis (user_id, nome, perfil, ativo) values (u_teste, 'Dono Teste', 'dono', true);
  -- o relatório "antes" também exige login (013)
  perform set_config('request.jwt.claims', json_build_object('sub', u_teste, 'role', 'authenticated')::text, true);
  select id into p_skol from produtos where nome = 'Skol 600ml' and ativo;
  select id into p_carne from produtos where nome = 'Carne' and categoria = 'Espetos da casa' and ativo;
  assert p_skol is not null and p_carne is not null, 'produtos de teste não encontrados';

  antes := relatorio_vendas(hoje, hoje);
  select coalesce((e->>'quantidade')::bigint, 0) into v_qtd_skol_antes
    from jsonb_array_elements(antes->'por_produto') e where e->>'nome' = 'Skol 600ml';
  v_qtd_skol_antes := coalesce(v_qtd_skol_antes, 0);

  perform set_config('request.jwt.claims', json_build_object('sub', u_teste, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated'; -- igual ao navegador, logado

  -- uma venda: 2 Skol (14,00 cada) + 1 Carne (10,00), com a Carne cancelada depois
  perform criar_pedido(908, jsonb_build_array(
    jsonb_build_object('produto_id', p_skol, 'quantidade', 2),
    jsonb_build_object('produto_id', p_carne, 'quantidade', 1)));
  select id into v_conta from contas where mesa_numero = 908 and status = 'aberta';
  select id into i_skol from itens_pedido where conta_id = v_conta and produto_id = p_skol;
  select id into i_carne from itens_pedido where conta_id = v_conta and produto_id = p_carne;
  perform mudar_estado_item(i_carne, 'cancelado');
  perform mudar_estado_item(i_skol, 'entregue');
  v_total := 2800; -- 2 x R$ 14,00 (a carne cancelada não conta)
  perform registrar_pagamento(v_conta, 'dinheiro', v_total::integer);
  perform fechar_conta(v_conta);

  depois := relatorio_vendas(hoje, hoje);

  assert (depois->>'vendas_centavos')::bigint - (antes->>'vendas_centavos')::bigint = v_total,
    'vendas devem subir exatamente o total da conta fechada';
  assert (depois->>'contas')::int - (antes->>'contas')::int = 1, 'deve contar 1 conta paga a mais';
  assert (depois->>'recebido_centavos')::bigint - (antes->>'recebido_centavos')::bigint = v_total,
    'recebido deve subir o valor do pagamento';
  assert (depois->>'cancelados_qtd')::int - (antes->>'cancelados_qtd')::int = 1, 'deve contar 1 cancelamento a mais';
  assert (depois->>'cancelados_centavos')::bigint - (antes->>'cancelados_centavos')::bigint = 1000,
    'cancelamento vale R$ 10,00';
  select coalesce((e->>'quantidade')::bigint, 0) into v_qtd_skol_depois
    from jsonb_array_elements(depois->'por_produto') e where e->>'nome' = 'Skol 600ml';
  assert v_qtd_skol_depois - v_qtd_skol_antes = 2, 'Skol deve subir 2 unidades no ranking';
  assert exists (select 1 from jsonb_array_elements(depois->'por_forma') e where e->>'forma' = 'dinheiro'),
    'dinheiro deve aparecer nas formas de pagamento';
  assert exists (select 1 from jsonb_array_elements(depois->'por_dia') e where e->>'dia' = hoje::text),
    'o dia de hoje deve aparecer no relatório por dia';

  -- período sem vendas e datas inválidas
  assert (relatorio_vendas('2000-01-01', '2000-01-02')->>'vendas_centavos')::bigint = 0, 'período vazio deve dar zero';
  v_ok := false;
  begin perform relatorio_vendas(hoje, hoje - 1); exception when others then v_ok := true; end;
  assert v_ok, 'data final antes da inicial deveria ser recusada';
  v_ok := false;
  begin perform relatorio_vendas(null, hoje); exception when others then v_ok := true; end;
  assert v_ok, 'data vazia deveria ser recusada';

  raise exception 'TESTE_OK: vendas, contas, recebido, cancelamentos, ranking e validações do relatório passaram';
end $$;
