# Jarrão Espetaria

Sistema web para integrar a operação do Jarrão Espetaria (Barretos – SP): pedidos feitos pelos garçons, telas em tempo real para cozinha e churrasqueira, acompanhamento da entrega, mesas/contas e caixa. Estoque e relatórios vêm em etapas posteriores.

**Status:** protótipo com dados fictícios. Ainda não está em uso real. Sem login (provisório).

## Documentação
- [Contexto do projeto](docs/CONTEXTO_DO_PROJETO.md) — como o restaurante funciona e o que queremos.
- [Decisões e pendências](docs/DECISOES.md) — o que já foi decidido e o que falta.
- [CLAUDE.md](CLAUDE.md) — instruções para o Claude Code.
- [`direcao_visual/`](direcao_visual/) — wireframes (HTML estático) usados como referência de estrutura das telas; `wireframe_correção.html` (ficha única por mesa) está na raiz do projeto.

## Identidade visual
Logo e ícones em `public/`, cores e tipografia em `app/globals.css` e `app/layout.js` (detalhes em [docs/DECISOES.md](docs/DECISOES.md)).

## Tecnologia
Next.js (telas) + Supabase (banco PostgreSQL e tempo real) + Vercel (hospedagem futura).

## Como rodar
1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode, nesta ordem: `supabase/migrations/001_fluxo_principal.sql`, `supabase/seed.sql`, `supabase/migrations/002_caixa.sql`, `supabase/migrations/003_correcoes.sql`, `supabase/migrations/004_cardapio_real.sql`, `supabase/migrations/005_mesas_livres.sql`, `supabase/migrations/006_cancelamento_lote_mesa.sql`, `supabase/migrations/007_relatorio_vendas.sql`, `supabase/migrations/008_login_permissoes.sql`, `supabase/migrations/009_corrige_trava_do_login.sql`, `supabase/migrations/010_cadastro_de_produtos.sql` e `supabase/migrations/011_estoque.sql`.
3. Copie `.env.example` para `.env.local` e preencha a URL e a chave `anon` (Project Settings → API).
4. Instale e rode:
   ```
   npm install
   npm run dev
   ```
   (No PowerShell do Windows, se o `npm` for bloqueado, use `npm.cmd`.)
5. Abra http://localhost:3000. Use `/garcom` em uma aba e `/cozinha` e `/churrasqueira` em outras.

Testes das regras: `npm test`.

Testes das funções do banco: arquivos em `supabase/tests/`. Cada um roda no SQL Editor do Supabase, não deixa dados (termina com um erro proposital que desfaz tudo) e deve responder com uma mensagem começando em `TESTE_OK`.

## Telas
- `/garcom` — digita a mesa e, se quiser, a pessoa (`12` ou `12/João`) e escolhe os itens.
- `/cozinha`, `/churrasqueira` — quadro Kanban em tempo real (Novos, Em preparo, Prontos), uma ficha por mesa com os itens do setor.
- `/mesas` — contas abertas, consumo por bloco (bebidas, espetos, cozinha), entrega, cancelamento, troca de mesa, mover item entre pessoas e histórico.
- `/caixa` — contas abertas, extrato, pagamentos (dinheiro, débito, crédito), saldo, histórico da conta e fechamento.
- `/vendas` — relatório: total vendido, ticket médio, recebido, cancelados, gráfico por dia, mais vendidos e formas de pagamento, por período.
- `/produtos` — (só o dono) cadastro de produtos: criar, editar nome, preço, setor e categoria, ativar/desativar; mudança de preço pede confirmação e tudo fica no histórico.
- `/estoque` — (caixa e dono) saldo dos produtos controlados, entradas (por unidade ou por caixa/embalagem), perdas, consumo interno e contagem. A venda dá baixa sozinha; o estoque nunca bloqueia uma venda. O dono escolhe o que é controlado.
- `/senha` — cada pessoa troca a própria senha.
- Nas telas da cozinha e da churrasqueira, item cancelado aparece num quadro vermelho até alguém tocar em "Ciente".

## Login e permissões
Já existe (migration 008), mas **a trava está desligada**: o sistema continua aberto como no protótipo. Com a trava ligada, só entra quem tem login e perfil ativo (garçom, cozinha, churrasqueira, caixa ou dono), e o banco confere o perfil em cada ação. O dono liga e desliga a trava e define os perfis na tela `/equipe`; as telas `/entrar` e `/equipe` já estão no menu. O passo a passo para ligar com segurança está em [docs/DECISOES.md](docs/DECISOES.md), seção 3 ("Login e permissões").

## Rumo ao uso real
Veja [docs/PLANO_PROFISSIONAL.md](docs/PLANO_PROFISSIONAL.md).

## Primeiro objetivo
Garçom registra pedido → itens vão ao setor correto → setor atualiza andamento → entrega registrada → consumo fica na conta da mesa.
