-- Migration 009: corrige definir_login_obrigatorio.
-- O Supabase (extensão safeupdate, ligada para o papel authenticator, que atende a API)
-- recusa qualquer UPDATE sem WHERE com o erro "UPDATE requires a WHERE clause".
-- A função da migration 008 atualizava a tabela de configuração sem WHERE, então o botão
-- "Exigir login de todos" falhava pela tela. Agora tem WHERE (a tabela tem uma só linha).
-- Os testes SQL rodam como administrador, onde essa proteção não existe: por isso o teste
-- 005 confere, olhando o código das funções, que nenhum UPDATE/DELETE fica sem WHERE.

create or replace function definir_login_obrigatorio(p_valor boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.perfil_atual() is distinct from 'dono' then
    raise exception 'Só o dono pode mudar isto' using errcode = '42501';
  end if;
  update public.configuracao set exigir_login = coalesce(p_valor, false) where id = true;
end;
$$;
