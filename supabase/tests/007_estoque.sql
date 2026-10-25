-- Teste do estoque (migration 011) com as contas reais de teste (dono, garçom, churrasqueira, cozinha)
-- e uma conta de caixa temporária. Tudo numa transação desfeita: nada fica no banco.
-- Resultado esperado: erro começando com "TESTE_OK".

do $$
declare
  u_dono uuid; u_garcom uuid; u_chur uuid; u_cozinha uuid;
  u_caixa uuid := gen_random_uuid();
  p_skol bigint; p_carne bigint;
  emb_caixa bigint; emb_outro bigint;
  v_saldo bigint; v_ok boolean; v_n bigint; v_conta bigint; i_item bigint; i_carne bigint;
begin
  select id into u_dono from auth.users where email = 'dono@gmail.com';
  select id into u_garcom from auth.users where email = 'garcom@gmail.com';
  select id into u_chur from auth.users where email = 'churrasqueira@gmail.com';
  select id into u_cozinha from auth.users where email = 'cozinha@gmail.com';
  assert u_dono is not null and u_garcom is not null and u_chur is not null and u_cozinha is not null, 'contas de teste não encontradas';
  select id into p_skol from produtos where nome = 'Skol 600ml' and ativo;
  select id into p_carne from produtos where nome = 'Carne' and categoria = 'Espetos da casa' and ativo;

  insert into auth.users (id, email, aud, role, instance_id)
  values (u_caixa, u_caixa::text || '@teste.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into perfis (user_id, nome, perfil, ativo) values (u_caixa, 'Caixa Teste', 'caixa', true);
  update configuracao set exigir_login = true;

  -- sem controle, nada de movimento ----------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform criar_pedido(920, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  execute 'reset role';
  assert (select count(*) from estoque_movimentos where produto_id = p_skol) = 0, 'produto sem controle não gera movimento';

  -- garçom não configura nem lê estoque -------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false; begin perform definir_controle_estoque(p_skol, true, 10); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não escolhe o que tem estoque';
  v_ok := false; begin perform salvar_embalagem(p_skol, 'caixa', 15); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não cadastra embalagem';
  execute 'reset role';

  -- dono configura -----------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform definir_controle_estoque(p_skol, true, 10);
  perform definir_controle_estoque(p_carne, true, 5);
  perform salvar_embalagem(p_skol, 'caixa', 15);
  perform salvar_embalagem(p_skol, 'caixa', 12); -- mesmo nome: atualiza, não duplica
  perform salvar_embalagem(p_skol, 'caixa', 15);
  perform salvar_embalagem(p_carne, 'pacote', 10);
  v_ok := false; begin perform definir_controle_estoque(p_skol, true, -1); exception when others then v_ok := true; end;
  assert v_ok, 'mínimo negativo deve ser recusado';
  v_ok := false; begin perform salvar_embalagem(p_skol, 'x', 1); exception when others then v_ok := true; end;
  assert v_ok, 'embalagem com 1 unidade deve ser recusada';
  assert (select count(*) from produto_embalagens where produto_id = p_skol) = 1, 'embalagem não duplica';
  execute 'reset role';
  select id into emb_caixa from produto_embalagens where produto_id = p_skol and nome = 'caixa';
  select id into emb_outro from produto_embalagens where produto_id = p_carne and nome = 'pacote';
  assert (select unidades from produto_embalagens where id = emb_caixa) = 15, 'caixa de 15 unidades';
  assert (select count(*) from produtos_historico where produto_id = p_skol and campo in ('controla_estoque', 'estoque_minimo')) = 2,
    'configurar o estoque fica no histórico do cardápio';

  -- caixa lança entradas ----------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_caixa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform registrar_entrada_estoque(p_skol, 3, emb_caixa, 'nota 123');
  perform registrar_entrada_estoque(p_skol, 5);
  perform registrar_entrada_estoque(p_carne, 10);
  v_ok := false; begin perform registrar_entrada_estoque(p_skol, 1, emb_outro); exception when others then v_ok := true; end;
  assert v_ok, 'embalagem de outro produto deve ser recusada';
  v_ok := false; begin perform registrar_entrada_estoque(p_skol, 0); exception when others then v_ok := true; end;
  assert v_ok, 'quantidade zero deve ser recusada';
  assert (select saldo from estoque_saldos where produto_id = p_skol) = 50, '3 caixas de 15 + 5 = 50';
  assert (select count(*) from estoque_saldos) >= 2, 'caixa vê os produtos controlados';
  execute 'reset role';
  select coalesce(sum(quantidade), 0) into v_saldo from estoque_movimentos where produto_id = p_skol;
  assert v_saldo = 50, 'saldo no banco confere';
  assert (select usuario_nome from estoque_movimentos where produto_id = p_skol and tipo = 'entrada' order by id limit 1) = 'Caixa Teste',
    'a entrada fica com o nome de quem lançou';
  assert (select detalhe from estoque_movimentos where produto_id = p_skol and tipo = 'entrada' order by id limit 1) like '3 caixa de 15%nota 123',
    'a entrada por embalagem explica a conta';

  -- garçom, churrasqueira e cozinha não lançam nem leem estoque ----------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false; begin perform registrar_entrada_estoque(p_skol, 1); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não lança entrada';
  assert (select count(*) from estoque_movimentos) = 0, 'garçom não lê os movimentos';
  assert (select count(*) from estoque_saldos) = 0, 'garçom não vê os saldos';
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_chur, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false; begin perform registrar_saida_estoque(p_carne, 'perda', 1); exception when others then v_ok := true; end;
  assert v_ok, 'churrasqueira não lança perda';
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_cozinha, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false; begin perform registrar_contagem_estoque(p_skol, 1); exception when others then v_ok := true; end;
  assert v_ok, 'cozinha não faz contagem';
  execute 'reset role';

  -- baixa automática ao lançar pedido -------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform criar_pedido(921, jsonb_build_array(
    jsonb_build_object('produto_id', p_skol, 'quantidade', 2),
    jsonb_build_object('produto_id', p_carne, 'quantidade', 2)));
  execute 'reset role';
  select coalesce(sum(quantidade), 0) into v_saldo from estoque_movimentos where produto_id = p_skol;
  assert v_saldo = 48, 'lançar 2 Skol tira 2 do estoque';
  select coalesce(sum(quantidade), 0) into v_saldo from estoque_movimentos where produto_id = p_carne;
  assert v_saldo = 8, 'lançar 2 Carne tira 2 do estoque';
  select id into v_conta from contas where mesa_numero = 921 and status = 'aberta';
  select id into i_item from itens_pedido where conta_id = v_conta and produto_id = p_skol;
  select id into i_carne from itens_pedido where conta_id = v_conta and produto_id = p_carne;
  assert (select count(*) from estoque_movimentos where item_id = i_item and tipo = 'venda' and quantidade = -2 and detalhe = 'Mesa 921') = 1,
    'a venda registra o item e a mesa';
  assert (select usuario_nome from estoque_movimentos where item_id = i_item) = 'Garçom', 'a venda fica com o nome do garçom';

  -- cancelar antes do preparo devolve; depois de iniciar, não ------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_caixa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform mudar_estado_item(i_item, 'cancelado');
  execute 'reset role';
  select coalesce(sum(quantidade), 0) into v_saldo from estoque_movimentos where produto_id = p_skol;
  assert v_saldo = 50, 'cancelar item novo devolve ao estoque';
  assert (select count(*) from estoque_movimentos where item_id = i_item and tipo = 'estorno') = 1, 'um estorno só';

  perform set_config('request.jwt.claims', json_build_object('sub', u_chur, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform mudar_estado_item(i_carne, 'em_preparo');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_caixa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform mudar_estado_item(i_carne, 'cancelado');
  execute 'reset role';
  select coalesce(sum(quantidade), 0) into v_saldo from estoque_movimentos where produto_id = p_carne;
  assert v_saldo = 8, 'cancelar depois de iniciar o preparo NÃO devolve ao estoque';
  assert (select count(*) from estoque_movimentos where item_id = i_carne and tipo = 'estorno') = 0, 'sem estorno depois do preparo';

  -- perda, consumo interno e contagem ---------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_caixa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform registrar_saida_estoque(p_skol, 'perda', 1, 'quebrou');
  perform registrar_saida_estoque(p_skol, 'consumo_interno', 2);
  v_ok := false; begin perform registrar_saida_estoque(p_skol, 'venda', 1); exception when others then v_ok := true; end;
  assert v_ok, 'tipo de saída inválido deve ser recusado';
  assert (select saldo from estoque_saldos where produto_id = p_skol) = 47, '50 - 1 perda - 2 consumo = 47';
  perform registrar_contagem_estoque(p_skol, 40, 'inventário');
  assert (select saldo from estoque_saldos where produto_id = p_skol) = 40, 'a contagem acerta o saldo para 40';
  perform registrar_contagem_estoque(p_skol, 40); -- bate com o sistema: não lança nada
  execute 'reset role';
  assert (select count(*) from estoque_movimentos where produto_id = p_skol and tipo = 'ajuste') = 1, 'contagem igual não gera ajuste';
  assert (select quantidade from estoque_movimentos where produto_id = p_skol and tipo = 'ajuste') = -7, 'ajuste de -7 (47 para 40)';

  -- o estoque nunca bloqueia a venda: pode ficar negativo -----------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform criar_pedido(922, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 99))); -- 99 é o teto (migration 012)
  execute 'reset role';
  select coalesce(sum(quantidade), 0) into v_saldo from estoque_movimentos where produto_id = p_skol;
  assert v_saldo = -59, 'vender além do estoque deixa o saldo negativo, sem bloquear';

  -- sem login ninguém lança nem configura estoque -----------------------------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  v_ok := false; begin perform definir_controle_estoque(p_skol, false, 0); exception when others then v_ok := true; end;
  assert v_ok, 'sem login ninguém configura o estoque';
  v_ok := false; begin perform registrar_entrada_estoque(p_skol, 1); exception when others then v_ok := true; end;
  assert v_ok, 'sem login ninguém lança entrada';
  execute 'reset role';

  raise exception 'TESTE_OK: configuração do dono, entradas por embalagem, baixa automática, estorno só antes do preparo, perda, consumo, contagem, saldo negativo e permissões passaram';
end $$;
