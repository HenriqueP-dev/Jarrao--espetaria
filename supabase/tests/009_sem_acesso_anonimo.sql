-- Teste da migration 013: sem login, nada; logado, só grava pelas funções; trava fixa.
-- NÃO deixa dados: termina com um erro proposital que desfaz tudo.
-- Resultado esperado: erro começando com "TESTE_OK".

do $$
declare
  v_lista text;
  v_ok boolean;
begin
  -- 1. o papel anônimo não executa nenhuma função do schema public
  select string_agg(p.proname, ', ') into v_lista
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and has_function_privilege('anon', p.oid, 'execute');
  assert v_lista is null, 'anon ainda executa: ' || coalesce(v_lista, '');

  -- 2. o anônimo só lê a configuração (a tela precisa saber que o login é exigido)
  select string_agg(c.relname, ', ') into v_lista
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm') and c.relname <> 'configuracao'
    and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
         or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'));
  assert v_lista is null, 'anon ainda acessa: ' || coalesce(v_lista, '');
  assert has_table_privilege('anon', 'public.configuracao', 'select'), 'anon precisa ler configuracao';
  assert not has_table_privilege('anon', 'public.configuracao', 'update'), 'anon não altera configuracao';

  -- 3. logado não grava direto em nenhuma tabela (só pelas funções)
  select string_agg(c.relname, ', ') into v_lista
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm')
    and (has_table_privilege('authenticated', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'update')
         or has_table_privilege('authenticated', c.oid, 'delete') or has_table_privilege('authenticated', c.oid, 'truncate'));
  assert v_lista is null, 'logado ainda grava direto em: ' || coalesce(v_lista, '');

  -- 4. logado continua executando as funções do dia a dia
  assert has_function_privilege('authenticated', 'public.criar_pedido(integer,jsonb,uuid)', 'execute'), 'criar_pedido';
  assert has_function_privilege('authenticated', 'public.registrar_pagamento(bigint,text,integer,uuid)', 'execute'), 'registrar_pagamento';
  assert has_function_privilege('authenticated', 'public.relatorio_vendas(date,date)', 'execute'), 'relatorio_vendas';

  -- 5. a trava não desliga nem por SQL comum, e o login é exigido mesmo sem a linha de configuração
  v_ok := false;
  begin update configuracao set exigir_login = false where id = true; exception when check_violation then v_ok := true; end;
  assert v_ok, 'a configuração não pode voltar ao modo aberto';
  assert private.login_exigido(), 'o login deve ser sempre exigido';

  -- 6. tabela nova criada depois já nasce fechada para o anônimo e sem gravação direta
  create table public.teste_padrao_013 (id int);
  assert not has_table_privilege('anon', 'public.teste_padrao_013', 'select'), 'tabela nova não pode nascer aberta ao anon';
  assert not has_table_privilege('authenticated', 'public.teste_padrao_013', 'insert'), 'tabela nova não pode nascer gravável';
  create function public.teste_padrao_013_fn() returns int language sql as 'select 1';
  assert not has_function_privilege('anon', 'public.teste_padrao_013_fn()', 'execute'), 'função nova não pode nascer aberta ao anon';

  raise exception 'TESTE_OK: anon sem funções e sem tabelas, logado só pelas funções, trava fixa e padrão fechado';
end $$;
