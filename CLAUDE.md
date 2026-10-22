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
- Mesas: 1–8 e 10–23 (não existe a 9).
- Pagamento é registro manual, não confirmação de maquininha.
- Dados fictícios nos testes. Sem campos obrigatórios sem finalidade clara.
- Mudanças pequenas e testáveis; escreva testes para regras importantes e diga o que foi (e não foi) testado.
- Explique antes de instalar dependências ou fazer mudanças estruturais.
- Sem commit nem deploy sem autorização do usuário.
- Outras IAs também editam este projeto: mantenha a documentação em dia e evite mexer em arquivos fora do escopo da tarefa.
