-- 013: fim do modo aberto. Sem login, ninguém lê nem grava nada (auditoria de 25/10/2026, A1).
-- Autorizado pelo desenvolvedor em 25/10/2026.
--
-- Antes: a "trava do login" era uma chave em `configuracao` que o dono podia desligar com um
-- clique; desligada, qualquer pessoa na internet (a chave anon é pública) podia lançar pedidos,
-- registrar pagamentos e ler tudo. Agora:
--   1. o login é sempre exigido (a chave não pode mais ser desligada, nem por SQL comum);
--   2. o papel anônimo (anon) não executa nenhuma função e só lê `configuracao`;
--   3. usuários logados só gravam pelas funções (que conferem o perfil), nunca direto nas tabelas;
--   4. tabelas e funções criadas no futuro já nascem sem acesso anônimo.

-- 1. Login sempre exigido ------------------------------------------------------------------
update configuracao set exigir_login = true where id = true;
alter table configuracao add constraint configuracao_login_sempre_exigido check (exigir_login);

-- Não depende mais da linha de configuração: mesmo se ela sumir, o login continua exigido.
create or replace function private.login_exigido()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select true;
$$;

-- A tela antiga de "Voltar ao modo aberto" agora recebe uma recusa clara.
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
  if not coalesce(p_valor, false) then
    raise exception 'O modo aberto foi desativado: o login é sempre exigido' using errcode = '42501';
  end if;
  update public.configuracao set exigir_login = true where id = true;
end;
$$;

-- 2. Nada de funções para quem não entrou --------------------------------------------------
-- (PUBLIC também, porque o anon herda dele)
revoke execute on function
  criar_pedido(integer, jsonb, uuid),
  mudar_estado_item(bigint, text),
  mudar_estado_itens(bigint[], text),
  confirmar_cancelamento(bigint),
  mudar_pessoa_item(bigint, text),
  trocar_mesa(bigint, integer),
  registrar_pagamento(bigint, text, integer, uuid),
  fechar_conta(bigint),
  relatorio_vendas(date, date),
  total_conta(bigint),
  registrar_entrada_estoque(bigint, integer, bigint, text),
  registrar_saida_estoque(bigint, text, integer, text),
  registrar_contagem_estoque(bigint, integer, text),
  definir_login_obrigatorio(boolean),
  definir_perfil(uuid, text, text, boolean),
  equipe(),
  usuarios_sem_perfil(),
  salvar_produto(bigint, text, integer, text, text, boolean, boolean),
  definir_controle_estoque(bigint, boolean, integer),
  salvar_embalagem(bigint, text, integer),
  remover_embalagem(bigint)
from public, anon;

grant execute on function
  criar_pedido(integer, jsonb, uuid),
  mudar_estado_item(bigint, text),
  mudar_estado_itens(bigint[], text),
  confirmar_cancelamento(bigint),
  mudar_pessoa_item(bigint, text),
  trocar_mesa(bigint, integer),
  registrar_pagamento(bigint, text, integer, uuid),
  fechar_conta(bigint),
  relatorio_vendas(date, date),
  total_conta(bigint),
  registrar_entrada_estoque(bigint, integer, bigint, text),
  registrar_saida_estoque(bigint, text, integer, text),
  registrar_contagem_estoque(bigint, integer, text),
  definir_login_obrigatorio(boolean),
  definir_perfil(uuid, text, text, boolean),
  equipe(),
  usuarios_sem_perfil(),
  salvar_produto(bigint, text, integer, text, text, boolean, boolean),
  definir_controle_estoque(bigint, boolean, integer),
  salvar_embalagem(bigint, text, integer),
  remover_embalagem(bigint)
to authenticated;

-- Funções auxiliares das regras de leitura: só para quem entrou.
revoke execute on function
  private.login_exigido(), private.perfil_atual(), private.acesso_liberado(),
  private.acesso_caixa(), private.exigir_perfil(text[])
from public, anon;
revoke usage on schema private from anon;

-- 3. Tabelas: anônimo só lê a configuração; logado só lê (grava pelas funções) -----------------
-- (as tabelas das migrations 010 e 011 tinham ficado com permissão de gravação herdada do
-- padrão do Supabase; as regras de leitura barravam, mas a permissão não deveria existir)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on configuracao to anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;

-- 4. O que for criado depois já nasce fechado para o anônimo e sem gravação direta -----------
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from authenticated;
