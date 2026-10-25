-- Teste das funções da migration 006, com um dono logado (antes: papel público anon, fechado na migration 013).
-- NÃO deixa dados: termina com um erro proposital que desfaz tudo.
-- Resultado esperado: erro começando com "TESTE_OK". Qualquer outra mensagem é falha
-- (uma "assert" que não passou mostra qual regra quebrou).
-- Rode no SQL Editor do Supabase (ou pela ferramenta de SQL).

do $$
declare
  u_teste uuid := gen_random_uuid(); -- dono temporário (desfeito no fim)
  p_skol bigint; p_carne bigint; p_quibe bigint;
  v_conta bigint;
  i_carne bigint; i_quibe bigint; i_skol bigint;
  v_n int; v_estado text; v_mesa int; v_ok boolean;
begin
  -- desde a migration 013 não existe modo aberto: o teste usa um dono temporário, logado
  insert into auth.users (id, email, aud, role, instance_id)
  values (u_teste, u_teste::text || '@teste.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into perfis (user_id, nome, perfil, ativo) values (u_teste, 'Dono Teste', 'dono', true);
  select id into p_skol from produtos where nome = 'Skol 600ml' and ativo;
  select id into p_carne from produtos where nome = 'Carne' and categoria = 'Espetos da casa' and ativo;
  select id into p_quibe from produtos where nome = 'Quibe Carne' and ativo;
  assert p_skol is not null and p_carne is not null and p_quibe is not null,
    'produtos de teste não encontrados';

  perform set_config('request.jwt.claims', json_build_object('sub', u_teste, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated'; -- igual ao navegador, logado

  -- mesa de teste (nunca usada de verdade): 901
  perform criar_pedido(901, jsonb_build_array(
    jsonb_build_object('produto_id', p_carne, 'quantidade', 2),
    jsonb_build_object('produto_id', p_quibe, 'quantidade', 1),
    jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  select id into v_conta from contas where mesa_numero = 901 and status = 'aberta';
  select id into i_carne from itens_pedido where conta_id = v_conta and produto_id = p_carne;
  select id into i_quibe from itens_pedido where conta_id = v_conta and produto_id = p_quibe;
  select id into i_skol from itens_pedido where conta_id = v_conta and produto_id = p_skol;

  -- A. cancelamento + ciente --------------------------------------------------
  perform mudar_estado_item(i_carne, 'cancelado');
  assert (select cancelamento_visto_em from itens_pedido where id = i_carne) is null,
    'cancelamento deve nascer sem ciente';
  perform confirmar_cancelamento(i_carne);
  assert (select cancelamento_visto_em from itens_pedido where id = i_carne) is not null,
    'ciente deve gravar a hora';
  select count(*) into v_n from historico where item_id = i_carne and evento = 'cancelamento_visto';
  assert v_n = 1, 'ciente deve gravar 1 evento no histórico';
  perform confirmar_cancelamento(i_carne); -- repetir não duplica
  select count(*) into v_n from historico where item_id = i_carne and evento = 'cancelamento_visto';
  assert v_n = 1, 'ciente repetido não pode duplicar o evento';
  v_ok := false;
  begin perform confirmar_cancelamento(i_quibe); exception when others then v_ok := true; end;
  assert v_ok, 'item não cancelado não pode receber ciente';

  -- B. mudança em lote, tudo ou nada -----------------------------------------
  v_ok := false;
  begin
    perform mudar_estado_itens(array[i_quibe, i_skol], 'em_preparo'); -- bebida não passa por preparo
  exception when others then v_ok := true; end;
  assert v_ok, 'lote com item inválido deveria falhar';
  select estado into v_estado from itens_pedido where id = i_quibe;
  assert v_estado = 'novo', 'lote deve ser tudo ou nada: o quibe tinha que continuar novo';
  perform mudar_estado_itens(array[i_quibe], 'em_preparo');
  select estado into v_estado from itens_pedido where id = i_quibe;
  assert v_estado = 'em_preparo', 'lote válido deve mudar o item';
  v_ok := false;
  begin perform mudar_estado_itens(array[]::bigint[], 'pronto'); exception when others then v_ok := true; end;
  assert v_ok, 'lote vazio deveria falhar';

  -- C. mover item entre pessoas ------------------------------------------------
  perform mudar_pessoa_item(i_quibe, 'Ana');
  assert (select pessoa from itens_pedido where id = i_quibe) = 'Ana', 'pessoa deve virar Ana';
  select count(*) into v_n from historico where item_id = i_quibe and evento = 'item_pessoa_alterada';
  assert v_n = 1, 'mudança de pessoa deve gravar 1 evento';
  perform mudar_pessoa_item(i_quibe, 'Ana'); -- sem mudança
  select count(*) into v_n from historico where item_id = i_quibe and evento = 'item_pessoa_alterada';
  assert v_n = 1, 'repetir a mesma pessoa não grava evento';
  perform mudar_pessoa_item(i_quibe, '   ');
  assert (select pessoa from itens_pedido where id = i_quibe) is null, 'nome vazio tira a pessoa';
  v_ok := false;
  begin perform mudar_pessoa_item(i_quibe, repeat('x', 61)); exception when others then v_ok := true; end;
  assert v_ok, 'nome com mais de 60 letras deveria ser recusado';
  v_ok := false;
  begin perform mudar_pessoa_item(i_carne, 'Bia'); exception when others then v_ok := true; end;
  assert v_ok, 'item cancelado não pode ser movido';

  -- D. trocar de mesa ----------------------------------------------------------
  perform trocar_mesa(v_conta, 902);
  select mesa_numero into v_mesa from contas where id = v_conta;
  assert v_mesa = 902, 'a conta deve ir para a mesa 902';
  assert exists (select 1 from mesas where numero = 902), 'mesa nova deve ser cadastrada';
  select count(*) into v_n from historico where conta_id = v_conta and evento = 'mesa_trocada';
  assert v_n = 1, 'troca de mesa grava 1 evento';
  perform criar_pedido(903, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  v_ok := false;
  begin perform trocar_mesa(v_conta, 903); exception when others then v_ok := true; end;
  assert v_ok, 'não pode trocar para mesa que já tem conta aberta';
  select mesa_numero into v_mesa from contas where id = v_conta;
  assert v_mesa = 902, 'a conta deve continuar na 902 depois da recusa';
  v_ok := false;
  begin perform trocar_mesa(v_conta, 902); exception when others then v_ok := true; end;
  assert v_ok, 'trocar para a mesma mesa deveria ser recusado';
  v_ok := false;
  begin perform trocar_mesa(v_conta, 0); exception when others then v_ok := true; end;
  assert v_ok, 'mesa 0 deveria ser recusada';
  v_ok := false;
  begin perform trocar_mesa(v_conta, 1000); exception when others then v_ok := true; end;
  assert v_ok, 'mesa 1000 deveria ser recusada';

  -- E. limites de tamanho dos textos --------------------------------------------
  v_ok := false;
  begin
    perform criar_pedido(904, jsonb_build_array(
      jsonb_build_object('produto_id', p_skol, 'quantidade', 1, 'pessoa', repeat('x', 61))));
  exception when others then v_ok := true; end;
  assert v_ok, 'pessoa com mais de 60 letras deveria ser recusada';
  v_ok := false;
  begin
    perform criar_pedido(904, jsonb_build_array(
      jsonb_build_object('produto_id', p_skol, 'quantidade', 1, 'detalhe', repeat('y', 201))));
  exception when others then v_ok := true; end;
  assert v_ok, 'observação com mais de 200 letras deveria ser recusada';
  assert not exists (select 1 from contas where mesa_numero = 904), 'recusa não pode deixar conta pela metade';

  raise exception 'TESTE_OK: ciente, lote atomico, mover pessoa, trocar mesa e limites passaram';
end $$;
