-- Teste da migration 015: estorno de pagamento.
-- NÃO deixa dados: termina com um erro proposital que desfaz tudo.
-- Resultado esperado: erro começando com "TESTE_OK".

do $$
declare
  u_dono uuid := gen_random_uuid(); u_caixa uuid := gen_random_uuid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  p_skol bigint; v_conta bigint; v_item bigint; v_pag bigint; v_total integer;
  v_ok boolean; v_rec_antes bigint; v_rec_depois bigint;
begin
  insert into auth.users (id, email, aud, role, instance_id)
  select u, u::text || '@teste.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
  from unnest(array[u_dono, u_caixa]) as u;
  insert into perfis (user_id, nome, perfil, ativo) values
    (u_dono, 'Dono Teste', 'dono', true), (u_caixa, 'Caixa Teste', 'caixa', true);
  select id into p_skol from produtos where nome = 'Skol 600ml' and ativo;

  -- caixa lança, entrega e recebe a conta inteira
  perform set_config('request.jwt.claims', json_build_object('sub', u_caixa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_rec_antes := (relatorio_vendas(hoje, hoje)->>'recebido_centavos')::bigint;
  perform criar_pedido(981, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 2)));
  select id into v_conta from contas where mesa_numero = 981 and status = 'aberta';
  select id into v_item from itens_pedido where conta_id = v_conta;
  v_total := total_conta(v_conta);
  perform registrar_pagamento(v_conta, 'credito', v_total);
  select id into v_pag from pagamentos where conta_id = v_conta;

  -- caixa não estorna
  v_ok := false; begin perform estornar_pagamento(v_pag, 'valor errado'); exception when others then v_ok := true; end;
  assert v_ok, 'caixa não estorna (só o dono)';
  execute 'reset role';

  -- dono estorna, com motivo
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false; begin perform estornar_pagamento(v_pag, '  '); exception when others then v_ok := true; end;
  assert v_ok, 'estorno sem motivo é recusado';
  perform estornar_pagamento(v_pag, 'Era débito, não crédito');
  v_ok := false; begin perform estornar_pagamento(v_pag, 'de novo'); exception when others then v_ok := true; end;
  assert v_ok, 'não estorna duas vezes';
  execute 'reset role';

  assert (select estornado_em is not null and estorno_motivo = 'Era débito, não crédito' from pagamentos where id = v_pag),
    'o pagamento continua na tabela, marcado como estornado';
  assert (select count(*) from historico where conta_id = v_conta and evento = 'pagamento_estornado' and usuario_nome = 'Dono Teste') = 1,
    'o estorno fica no histórico com o nome do dono';

  -- depois do estorno: a conta volta a dever tudo, não fecha, aceita o pagamento certo
  perform set_config('request.jwt.claims', json_build_object('sub', u_caixa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform mudar_estado_item(v_item, 'entregue');
  v_ok := false; begin perform fechar_conta(v_conta); exception when others then v_ok := true; end;
  assert v_ok, 'conta com pagamento estornado não fecha';
  perform registrar_pagamento(v_conta, 'debito', v_total);
  v_rec_depois := (relatorio_vendas(hoje, hoje)->>'recebido_centavos')::bigint;
  assert v_rec_depois - v_rec_antes = v_total, 'o relatório conta só o pagamento válido, não o estornado';
  perform fechar_conta(v_conta);
  execute 'reset role';
  assert (select status from contas where id = v_conta) = 'fechada', 'paga certo, a conta fecha';

  -- conta fechada não aceita estorno
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false;
  begin perform estornar_pagamento((select id from pagamentos where conta_id = v_conta and estornado_em is null), 'teste');
  exception when others then v_ok := true; end;
  assert v_ok, 'conta fechada não tem estorno';

  -- com todos os pagamentos estornados, volta a dar para cancelar item
  perform criar_pedido(982, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  select id into v_conta from contas where mesa_numero = 982 and status = 'aberta';
  select id into v_item from itens_pedido where conta_id = v_conta;
  perform registrar_pagamento(v_conta, 'dinheiro', 100);
  select id into v_pag from pagamentos where conta_id = v_conta;
  v_ok := false; begin perform mudar_estado_item(v_item, 'cancelado'); exception when others then v_ok := true; end;
  assert v_ok, 'com pagamento válido não cancela item';
  perform estornar_pagamento(v_pag, 'cliente desistiu');
  perform mudar_estado_item(v_item, 'cancelado');
  execute 'reset role';

  -- sem login: nada
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  v_ok := false; begin perform estornar_pagamento(v_pag, 'invasor'); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'sem login não estorna';
  execute 'reset role';

  raise exception 'TESTE_OK: estorno só do dono, com motivo, uma vez, conta aberta, histórico, saldo e relatório';
end $$;
