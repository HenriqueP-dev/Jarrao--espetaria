-- Teste de criar_pedido e mudar_estado_item (migrations 004 e 005), como o papel público.
-- NÃO deixa dados: termina com um erro proposital que desfaz tudo.
-- Resultado esperado: erro começando com "TESTE_OK". Qualquer outra mensagem é falha.

do $$
declare
  p_skol bigint; p_jant bigint;
  v_conta bigint; i_skol bigint; i_jant bigint; v_ok boolean;
begin
  select id into p_skol from produtos where nome = 'Skol 600ml' and ativo;
  select id into p_jant from produtos where nome = 'Jantinha Simples' and ativo;
  assert p_skol is not null and p_jant is not null, 'produtos de teste não encontrados';

  execute 'set local role anon'; -- igual ao navegador

  -- mesa 905 não existe no cadastro: deve ser aceita e cadastrada na hora (migration 005)
  perform criar_pedido(905, jsonb_build_array(
    jsonb_build_object('produto_id', p_skol, 'quantidade', 1, 'pessoa', 'Teste'),
    jsonb_build_object('produto_id', p_jant, 'quantidade', 1, 'pessoa', 'Teste', 'detalhe', 'Espeto: Carne')));
  select id into v_conta from contas where mesa_numero = 905 and status = 'aberta';
  assert v_conta is not null, 'conta da mesa 905 deveria estar aberta';
  assert exists (select 1 from mesas where numero = 905), 'mesa 905 deveria ser cadastrada';
  select id into i_skol from itens_pedido where conta_id = v_conta and produto_id = p_skol;
  select id into i_jant from itens_pedido where conta_id = v_conta and produto_id = p_jant;
  assert (select setor from itens_pedido where id = i_skol) = 'garcom', 'bebida deve ir para o setor garçom';
  assert (select setor from itens_pedido where id = i_jant) = 'churrasqueira', 'jantinha deve ir para a churrasqueira';
  assert (select detalhe from itens_pedido where id = i_jant) = 'Espeto: Carne', 'espeto deve ficar na observação';

  -- bebida vai de novo direto para entregue; jantinha não
  perform mudar_estado_item(i_skol, 'entregue');
  v_ok := false;
  begin perform mudar_estado_item(i_jant, 'entregue'); exception when others then v_ok := true; end;
  assert v_ok, 'jantinha não pode ir de novo direto para entregue';

  -- jantinha exige o espeto
  v_ok := false;
  begin
    perform criar_pedido(906, jsonb_build_array(jsonb_build_object('produto_id', p_jant, 'quantidade', 1)));
  exception when others then v_ok := true; end;
  assert v_ok, 'jantinha sem espeto deveria ser recusada';

  -- limites da mesa (1 a 999)
  v_ok := false;
  begin
    perform criar_pedido(0, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  exception when others then v_ok := true; end;
  assert v_ok, 'mesa 0 deveria ser recusada';
  v_ok := false;
  begin
    perform criar_pedido(1000, jsonb_build_array(jsonb_build_object('produto_id', p_skol, 'quantidade', 1)));
  exception when others then v_ok := true; end;
  assert v_ok, 'mesa 1000 deveria ser recusada';

  raise exception 'TESTE_OK: mesa livre, setores, entrega de bebida e regras da jantinha passaram';
end $$;
