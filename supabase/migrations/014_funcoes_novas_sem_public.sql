-- 014: complemento da 013. Funções criadas daqui em diante não nascem executáveis por todos.
--
-- O Postgres dá permissão de execução a PUBLIC (todo mundo, inclusive o anon) para toda função
-- nova, e isso só pode ser desligado no padrão GLOBAL do papel (a regra "in schema public" da
-- 013 não alcança o PUBLIC; descoberto pelo teste 009). Cada função nova precisa então de
-- `grant execute ... to authenticated` explícito, como o CLAUDE.md já pede.

alter default privileges for role postgres revoke execute on functions from public;
