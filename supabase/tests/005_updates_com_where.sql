-- Guarda contra o erro "UPDATE requires a WHERE clause" (migration 009).
-- A API do Supabase usa a extensão safeupdate, que recusa UPDATE/DELETE sem WHERE. Os outros
-- testes SQL rodam como administrador, onde essa proteção não existe, então este confere o
-- CÓDIGO das funções: nenhum UPDATE ou DELETE pode ficar sem WHERE.
-- Não deixa dados. Resultado esperado: erro começando com "TESTE_OK".

do $$
declare
  v_culpadas text;
  u_dono uuid;
  padrao constant text := '\y(update\s+[a-z_.]+\s+set|delete\s+from)\y';
  v_ligou boolean;
begin
  -- controle: o detector precisa acusar o código antigo e aceitar o corrigido
  assert 'update public.configuracao set exigir_login = x' ~* padrao
         and 'update public.configuracao set exigir_login = x' !~* '\ywhere\y',
    'o detector deveria acusar um UPDATE sem WHERE';
  assert 'update public.configuracao set exigir_login = x where id = true' ~* '\ywhere\y',
    'o detector deveria aceitar um UPDATE com WHERE';

  -- varredura de todas as funções dos schemas public e private
  select string_agg(distinct f.proname || ' -> ' || left(f.s, 70), E'\n') into v_culpadas
  from (
    select p.proname,
           btrim(regexp_replace(stmt, '\s+', ' ', 'g')) as s
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname in ('public', 'private')
    join pg_language l on l.oid = p.prolang and l.lanname in ('plpgsql', 'sql')
    cross join lateral regexp_split_to_table(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), ';') as stmt
  ) f
  where f.s ~* padrao and f.s !~* '\ywhere\y';
  assert v_culpadas is null, 'UPDATE/DELETE sem WHERE nestas funções: ' || coalesce(v_culpadas, '');

  -- o dono real confirma a trava ligada pela API (a chamada que falhava pela tela);
  -- desligar não é mais possível desde a migration 013
  select id into u_dono from auth.users where email = 'dono@gmail.com';
  if u_dono is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform definir_login_obrigatorio(true);
    execute 'reset role';
    select exigir_login into v_ligou from configuracao;
    assert v_ligou, 'o dono deveria conseguir confirmar a trava ligada';
  end if;

  raise exception 'TESTE_OK: nenhum UPDATE/DELETE sem WHERE nas funções, e o dono confirma a trava pela função';
end $$;
