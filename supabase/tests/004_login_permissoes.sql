-- Teste do login e das permissões (migration 008) com a trava LIGADA, simulando cada perfil.
-- Tudo acontece dentro de uma transação desfeita: os usuários, os perfis, a trava ligada e
-- os pedidos de teste NÃO ficam no banco. Termina com um erro proposital.
-- Resultado esperado: erro começando com "TESTE_OK". Qualquer outra mensagem é falha.

do $$
declare
  u_garcom uuid := gen_random_uuid(); u_cozinha uuid := gen_random_uuid();
  u_chur uuid := gen_random_uuid(); u_caixa uuid := gen_random_uuid();
  u_dono uuid := gen_random_uuid(); u_novo uuid := gen_random_uuid();
  u_inativo uuid := gen_random_uuid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  p_skol bigint; p_carne bigint; p_quibe bigint;
  v_conta bigint; i_carne bigint; i_carne2 bigint; i_quibe bigint; i_skol bigint;
  v_ok boolean; v_n bigint; v_total integer;
begin
  select id into p_skol from produtos where nome = 'Skol 600ml' and ativo;
  select id into p_carne from produtos where nome = 'Carne' and categoria = 'Espetos da casa' and ativo;
  select id into p_quibe from produtos where nome = 'Quibe Carne' and ativo;
  assert p_skol is not null and p_carne is not null and p_quibe is not null, 'produtos de teste não encontrados';

  -- usuários e perfis de teste (u_novo fica sem perfil de propósito)
  insert into auth.users (id, email, aud, role, instance_id)
  select u, u::text || '@teste.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
  from unnest(array[u_garcom, u_cozinha, u_chur, u_caixa, u_dono, u_novo, u_inativo]) as u;
  insert into perfis (user_id, nome, perfil, ativo) values
    (u_garcom, 'Garçom Teste', 'garcom', true),
    (u_cozinha, 'Cozinha Teste', 'cozinha', true),
    (u_chur, 'Churrasqueira Teste', 'churrasqueira', true),
    (u_caixa, 'Caixa Teste', 'caixa', true),
    (u_dono, 'Dono Teste', 'dono', true),
    (u_inativo, 'Inativo Teste', 'garcom', false);

  -- liga a trava (só nesta transação)
  update configuracao set exigir_login = true;

  -- A. sem login (anon) ------------------------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  v_ok := false;
  begin perform criar_pedido(911, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  exception when others then v_ok := true; end;
  assert v_ok, 'sem login não pode lançar pedido';
  assert (select count(*) from produtos) = 0, 'sem login não pode ler produtos';
  assert (select count(*) from contas) = 0, 'sem login não pode ler contas';
  assert (select count(*) from pagamentos) = 0, 'sem login não pode ler pagamentos';
  assert (select exigir_login from configuracao) = true, 'a tela precisa conseguir ler a chave sem login';
  v_ok := false;
  begin perform definir_login_obrigatorio(false); exception when others then v_ok := true; end;
  assert v_ok, 'sem login não pode desligar a trava';
  v_ok := false;
  begin perform relatorio_vendas(hoje, hoje); exception when others then v_ok := true; end;
  assert v_ok, 'sem login não pode ver o relatório';
  execute 'reset role';

  -- B. logado, mas sem perfil, e desativado ---------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_novo, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false;
  begin perform criar_pedido(911, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  exception when others then v_ok := true; end;
  assert v_ok, 'usuário sem perfil não pode lançar pedido';
  assert (select count(*) from produtos) = 0, 'usuário sem perfil não pode ler produtos';
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_inativo, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false;
  begin perform criar_pedido(911, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  exception when others then v_ok := true; end;
  assert v_ok, 'usuário desativado não pode lançar pedido';
  execute 'reset role';

  -- C. garçom -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform criar_pedido(911, jsonb_build_array(
    jsonb_build_object('produto_id', p_carne, 'quantidade', 1),
    jsonb_build_object('produto_id', p_quibe, 'quantidade', 1),
    jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  perform criar_pedido(911, jsonb_build_array(jsonb_build_object('produto_id', p_carne, 'quantidade', 1)));
  assert (select count(*) from produtos) > 0, 'garçom precisa ler o cardápio';
  select id into v_conta from contas where mesa_numero = 911 and status = 'aberta';
  assert v_conta is not null, 'garçom precisa ler a conta que abriu';
  select min(id), max(id) into i_carne, i_carne2 from itens_pedido where conta_id = v_conta and produto_id = p_carne;
  select id into i_quibe from itens_pedido where conta_id = v_conta and produto_id = p_quibe;
  select id into i_skol from itens_pedido where conta_id = v_conta and produto_id = p_skol;
  assert i_carne <> i_carne2, 'deveria haver duas linhas de carne';

  v_ok := false; begin perform mudar_estado_item(i_carne, 'cancelado'); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não pode cancelar';
  v_ok := false; begin perform mudar_estado_item(i_carne, 'em_preparo'); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não prepara item';
  v_ok := false; begin perform registrar_pagamento(v_conta, 'dinheiro', 100); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não registra pagamento';
  v_ok := false; begin perform fechar_conta(v_conta); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não fecha conta';
  assert (select count(*) from pagamentos) = 0, 'garçom não lê pagamentos';
  v_ok := false; begin perform relatorio_vendas(hoje, hoje); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não vê o relatório';
  v_ok := false; begin perform equipe(); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não vê a equipe';
  v_ok := false; begin perform definir_perfil(u_garcom, 'X', 'dono', true); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não vira dono';
  v_ok := false; begin perform definir_login_obrigatorio(false); exception when others then v_ok := true; end;
  assert v_ok, 'garçom não desliga a trava';
  assert (select count(*) from perfis) = 1, 'garçom só enxerga o próprio perfil';

  perform mudar_estado_item(i_skol, 'entregue'); -- bebida: entregar é com o garçom
  perform mudar_pessoa_item(i_quibe, 'Ana');
  perform trocar_mesa(v_conta, 912);
  execute 'reset role';

  assert not exists (select 1 from historico where conta_id = v_conta and usuario_id is distinct from u_garcom),
    'todo evento dessa conta até aqui deve ter o garçom como autor';
  assert (select count(*) from historico where conta_id = v_conta and usuario_nome = 'Garçom Teste') >= 6,
    'o nome do garçom deve estar no histórico';

  -- D. churrasqueira (só itens do próprio setor) ---------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_chur, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform mudar_estado_itens(array[i_carne], 'em_preparo');
  perform mudar_estado_item(i_carne, 'pronto');
  v_ok := false; begin perform mudar_estado_item(i_quibe, 'em_preparo'); exception when others then v_ok := true; end;
  assert v_ok, 'churrasqueira não mexe em item da cozinha';
  v_ok := false; begin perform mudar_estado_item(i_carne, 'entregue'); exception when others then v_ok := true; end;
  assert v_ok, 'churrasqueira não entrega';
  v_ok := false; begin perform mudar_estado_item(i_carne2, 'cancelado'); exception when others then v_ok := true; end;
  assert v_ok, 'churrasqueira não cancela';
  v_ok := false; begin perform criar_pedido(913, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1))); exception when others then v_ok := true; end;
  assert v_ok, 'churrasqueira não lança pedido';
  execute 'reset role';

  -- E. cozinha (só itens do próprio setor) -----------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_cozinha, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false; begin perform mudar_estado_item(i_carne2, 'em_preparo'); exception when others then v_ok := true; end;
  assert v_ok, 'cozinha não mexe em item da churrasqueira';
  perform mudar_estado_item(i_quibe, 'em_preparo');
  execute 'reset role';

  -- F. caixa: cancela, setores dão ciente, recebe e fecha ---------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_caixa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform mudar_estado_item(i_carne2, 'cancelado');
  assert (select count(*) from pagamentos) > 0, 'caixa lê os pagamentos';
  assert (relatorio_vendas(hoje, hoje)->>'contas') is not null, 'caixa vê o relatório';
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_cozinha, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false; begin perform confirmar_cancelamento(i_carne2); exception when others then v_ok := true; end;
  assert v_ok, 'cozinha não dá ciente em cancelamento da churrasqueira';
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_chur, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform confirmar_cancelamento(i_carne2);
  execute 'reset role';
  assert (select cancelamento_visto_em from itens_pedido where id = i_carne2) is not null, 'ciente da churrasqueira deve valer';

  perform set_config('request.jwt.claims', json_build_object('sub', u_caixa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform mudar_estado_item(i_quibe, 'pronto');
  perform mudar_estado_itens(array[i_carne, i_quibe], 'entregue');
  select total_conta(v_conta) into v_total;
  perform registrar_pagamento(v_conta, 'dinheiro', v_total);
  perform fechar_conta(v_conta);
  execute 'reset role';
  assert (select status from contas where id = v_conta) = 'fechada', 'caixa deve conseguir fechar a conta';

  -- G. dono: equipe e a trava ---------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert (select count(*) from equipe()) >= 6, 'dono vê a equipe';
  assert exists (select 1 from usuarios_sem_perfil() where id = u_novo), 'dono vê quem ainda não tem perfil';
  assert (select count(*) from perfis) >= 6, 'dono lê todos os perfis';
  perform definir_perfil(u_novo, 'Novo Teste', 'garcom', true);
  v_ok := false; begin perform definir_perfil(u_dono, 'Dono Teste', 'garcom', true); exception when others then v_ok := true; end;
  assert v_ok, 'não pode tirar o último dono';
  v_ok := false; begin perform definir_perfil(u_dono, 'Dono Teste', 'dono', false); exception when others then v_ok := true; end;
  assert v_ok, 'não pode desativar o último dono';
  perform criar_pedido(914, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  perform definir_perfil(u_garcom, 'Garçom Teste', 'garcom', false); -- desativa o garçom
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_garcom, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_ok := false;
  begin perform criar_pedido(915, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  exception when others then v_ok := true; end;
  assert v_ok, 'garçom desativado deve perder o acesso na hora';
  execute 'reset role';

  -- H. dono desliga a trava: volta o modo aberto ----------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform definir_login_obrigatorio(false);
  execute 'reset role';
  assert (select exigir_login from configuracao) = false, 'dono deve conseguir desligar a trava';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  perform criar_pedido(916, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  execute 'reset role';

  raise exception 'TESTE_OK: sem login, sem perfil, desativado, garçom, churrasqueira, cozinha, caixa, dono, autor no histórico e desligar a trava passaram';
end $$;
