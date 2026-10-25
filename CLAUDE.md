# Jarrão Espetaria — instruções para o Claude Code

Sistema web para a operação de um restaurante (pedidos, setores, mesas/contas, caixa; estoque e relatórios depois). O dono do projeto é estudante: explique decisões em linguagem simples e em português.

## Referência principal
- Leia `docs/CONTEXTO_DO_PROJETO.md` antes de trabalhar. Ele é a fonte das regras de negócio. Não o duplique em outros arquivos; só faça referência a ele.
- Decisões e hipóteses ficam em `docs/DECISOES.md`. Atualize quando uma regra mudar. Nada ali foi aprovado pelo dono do restaurante: diferencie fatos, preferências, propostas e pendências.
- Cardápio e preços informados ficam em `docs/CARDAPIO.md`. Nunca cadastre produto sem preço confirmado (nem com valor zero).

## Regras
- Não invente regras de negócio: marque como hipótese em `docs/DECISOES.md` e pergunte.
- Jantinha vai só para a churrasqueira. Não crie segunda ordem digital para a cozinha.
- Destino de cada produto vem do cadastro, nunca fixo no código.
- Pedido registrado, preparado, entregue e pago são acontecimentos distintos.
- Nunca apague registros silenciosamente: cancelamentos e alterações ficam no histórico.
- Mesas: o garçom digita o número (campo único "12" ou "12/João"), de 1 a 999, porque o restaurante às vezes empresta mesas do vizinho. As mesas próprias são 1–8 e 10–23, mas o sistema não restringe a esses números.
- Pagamento é registro manual, não confirmação de maquininha.
- Toda função do banco que grava dados deve chamar `private.exigir_perfil(...)` no começo, com a lista de perfis permitidos (migration 008). Perfis ficam na tabela `perfis`, nunca em dados que o próprio usuário edita. Nova tabela precisa de `grant select ... to authenticated` e de regra de leitura (RLS); nova função precisa de `grant execute ... to authenticated` (desde as migrations 013/014 nada nasce aberto ao anônimo nem gravável direto). Login é sempre exigido: não existe mais modo aberto.
- `UPDATE` e `DELETE` sempre com `WHERE`: a API do Supabase (extensão safeupdate) recusa sem. Os testes SQL rodam como administrador e não pegam isso; confira com `supabase/tests/005_updates_com_where.sql`. Teste o fluxo real pelo navegador sempre que a ação depender de chamadas autenticadas.
- Migrations são aplicadas pela ferramenta do Supabase e o arquivo SQL fica em `supabase/migrations/`; cada função de gravação tem teste em `supabase/tests/` (transação desfeita). Os testes SQL simulam um usuário logado com perfil (o anônimo não executa nada).
- Dados fictícios nos testes. Sem campos obrigatórios sem finalidade clara.
- Mudanças pequenas e testáveis; escreva testes para regras importantes e diga o que foi (e não foi) testado.
- Explique antes de instalar dependências ou fazer mudanças estruturais.
- Sem commit nem deploy sem autorização do usuário.
- Outras IAs também editam este projeto: mantenha a documentação em dia e evite mexer em arquivos fora do escopo da tarefa.
