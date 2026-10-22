# Jarrão Espetaria

Sistema web para integrar a operação do Jarrão Espetaria (Barretos – SP): pedidos feitos pelos garçons, telas em tempo real para cozinha e churrasqueira, acompanhamento da entrega, mesas/contas e caixa. Estoque e relatórios vêm em etapas posteriores.

**Status:** protótipo com dados fictícios. Ainda não está em uso real. Sem login (provisório).

## Documentação
- [Contexto do projeto](docs/CONTEXTO_DO_PROJETO.md) — como o restaurante funciona e o que queremos.
- [Decisões e pendências](docs/DECISOES.md) — o que já foi decidido e o que falta.
- [CLAUDE.md](CLAUDE.md) — instruções para o Claude Code.

## Tecnologia
Next.js (telas) + Supabase (banco PostgreSQL e tempo real) + Vercel (hospedagem futura).

## Como rodar
1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode, nesta ordem: `supabase/migrations/001_fluxo_principal.sql`, `supabase/seed.sql`, `supabase/migrations/002_caixa.sql`, `supabase/migrations/003_correcoes.sql` e `supabase/migrations/004_cardapio_real.sql`.
3. Copie `.env.example` para `.env.local` e preencha a URL e a chave `anon` (Project Settings → API).
4. Instale e rode:
   ```
   npm install
   npm run dev
   ```
   (No PowerShell do Windows, se o `npm` for bloqueado, use `npm.cmd`.)
5. Abra http://localhost:3000. Use `/garcom` em uma aba e `/cozinha` e `/churrasqueira` em outras.

Testes das regras: `npm test`.

## Telas
- `/garcom` — escolhe mesa, pessoa (opcional) e itens.
- `/cozinha`, `/churrasqueira` — itens do setor, em tempo real (Em preparo / Pronto).
- `/mesas` — contas abertas, consumo, entrega, cancelamento e histórico.
- `/caixa` — contas abertas, pagamentos (dinheiro, débito, crédito) e fechamento da conta.

## Rumo ao uso real
Veja [docs/PLANO_PROFISSIONAL.md](docs/PLANO_PROFISSIONAL.md).

## Primeiro objetivo
Garçom registra pedido → itens vão ao setor correto → setor atualiza andamento → entrega registrada → consumo fica na conta da mesa.
