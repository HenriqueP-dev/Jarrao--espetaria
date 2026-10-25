# Auditoria do projeto — 25/10/2026

Somente leitura: nenhum código, dado ou configuração foi alterado. Baseada nos arquivos, no banco real (consultas de leitura), nos relatórios do Supabase, em `npm audit`, `npm outdated` e `npm test`.

## O que foi e o que não foi verificado
**Executado:** testes JS (103 passam), `npm audit` (0 vulnerabilidades), `npm outdated` (nada desatualizado), relatórios de segurança e desempenho do Supabase, leitura do código das telas e das funções `criar_pedido`, `registrar_pagamento`, `fechar_conta`, lista de índices, políticas RLS, publicações de tempo real, permissões de execução das funções, restrições `CHECK`, busca de segredos em todo o histórico do Git (nenhum encontrado; `.env.local` está no `.gitignore`).
**Não verificado (sem acesso ou sem ambiente):** backups e plano do projeto Supabase; limites de tentativas de login e tamanho mínimo de senha configurados no Auth; desempenho real (Lighthouse, tamanho dos pacotes, teste de carga); fluxos autenticados pelo navegador (a trava impede o meu acesso); comportamento em produção na Vercel (ainda não publicado).

## Dependências entre correções
1. Revogar acesso anônimo (A1) só é seguro depois de a trava ficar permanente. 2. Trava de clique duplo (C2) e chave de idempotência (C1) são independentes e rápidas. 3. Páginas de erro/404 (C4) e monitoramento não dependem de nada. 4. Índices e paginação (B) só depois de haver volume.

---
## A. Vulnerabilidades de segurança

**A1 — ALTA (ao publicar). 11 funções de gravação executáveis sem login.**
- Evidência: relatório do Supabase e consulta `has_function_privilege('anon', ...)`: `criar_pedido`, `registrar_pagamento`, `fechar_conta`, `confirmar_cancelamento`, `mudar_estado_item(s)`, `mudar_pessoa_item`, `trocar_mesa`, `registrar_*_estoque` têm `EXECUTE` para `anon`. Hoje cada uma recusa por dentro (`private.exigir_perfil`) porque a trava está ligada; verificado pela API pública.
- Risco: a trava é uma chave que o dono pode desligar com um clique. Desligada, a internet inteira (chave `anon` é pública) pode criar pedidos, registrar pagamentos e fechar contas, e ler tudo (`acesso_liberado()` vira verdadeiro).
- Correção: nova migration `revoke execute ... from anon` nessas funções e nas leituras; tornar o modo aberto inexistente (remover a chave ou impedir desligar em produção).
- Arquivos: migrations 005/006/008/011 (novas funções), `app/equipe/page.js` (botão "voltar ao modo aberto").
- Efeitos: some o modo aberto do protótipo; testes 001–003 precisam de ajuste (hoje desligam a trava).
- Teste: chamar cada função com a chave anônima e esperar "permission denied"; reexecutar testes SQL 001–007; fluxo completo logado por perfil.

**A2 — MÉDIA. Senhas: proteção contra senhas vazadas desligada** (aviso do Supabase; recurso de plano pago). A regra de 8 caracteres existe só em `/senha`; o mínimo do próprio Auth e o limite de tentativas não foram verificados.
- Correção: conferir Authentication → Policies/Rate limits; exigir ≥ 10 caracteres; considerar 2FA (TOTP) para o dono.
- Teste: tentar criar senha fraca pela API de usuário; tentativas seguidas de login errado devem ser limitadas.

**A3 — MÉDIA. Quantidades sem teto no banco.** `criar_pedido` aceita `quantidade` de qualquer tamanho e número ilimitado de itens; só há `quantidade > 0`. Um erro de digitação (ex.: 10000) cria pedido absurdo, e `preco × quantidade` pode estourar o inteiro em `total_conta`, travando o fechamento da conta. Também não há teto de valor em `registrar_pagamento`.
- Correção: `CHECK (quantidade between 1 and 99)`, máximo de itens por pedido, na função e na tela. Arquivos: migration nova, `lib/pedido.js`.
- Efeito: quantidades legítimas muito grandes (festas) precisariam de exceção. Teste: SQL com 100, 100000 e 2.000.000.000.

**A4 — BAIXA. Mensagens cruas do banco na tela** (`error.message` em ~24 pontos): podem mostrar termos técnicos ao usuário. Correção: traduzir por código. Arquivos: `app/**/page.js`. Teste: forçar cada erro conhecido.

**A5 — BAIXA. CSP com `'unsafe-inline'`** e sessão guardada no `localStorage` (padrão do supabase-js). Sem uso de `innerHTML`/`dangerouslySetInnerHTML` (busca feita), então o risco de XSS é baixo hoje. Correção futura: CSP com nonce (exige páginas dinâmicas) ou cookies via `@supabase/ssr`. Teste: cabeçalhos em produção.

**A6 — BAIXA. Proteção de rotas só no navegador** (`Guarda`). O pacote JavaScript das telas é público; a segurança real vem do RLS e das funções, que estão corretas (12 de 12 tabelas com RLS, `search_path` fixo, `UPDATE` com `WHERE` testado). Aceitável; documentado.

**A7 — INFORMATIVO.** Dependências: 0 vulnerabilidades, nada desatualizado. Nenhum segredo no código ou no histórico. Cadastro livre desligado (conferido). `private.perfil_atual` e similares executáveis por `anon`: só devolvem nulo/falso, sem risco.

---
## B. Desempenho

**B1 — MÉDIA. Recarga completa a cada evento.** `TelaSetor`, `mesas`, `caixa` refazem todas as consultas a cada mudança em `itens_pedido`/`contas` (tempo real) **e** a cada 15 s (`setInterval`). Com 4 telas abertas, cada pedido dispara 4+ recargas completas; `mesas` e `caixa` recarregam `itens_pedido`, `pagamentos` e `historico` de **todas** as contas abertas (`select('*')`).
- Hoje: 32 contas, 111 itens, 473 históricos — imperceptível. Em um sábado cheio cresce.
- Correção: selecionar só colunas usadas; carregar o histórico só da conta aberta; atualizar o item alterado pelo payload; manter polling só como reserva (60 s).
- Teste: contar requisições na aba Rede com 30 pedidos simulados (banco de teste).

**B2 — BAIXA. 7 chaves estrangeiras sem índice** (`itens_pedido.conta_id/pedido_id/produto_id`, `historico.conta_id/item_id`, `pagamentos.conta_id`, `pedidos.conta_id`) e nenhum índice em `itens_pedido(setor, estado)`. Sem efeito com 111 linhas; relevante em meses de uso. Correção: migration de índices. Teste: `EXPLAIN` antes/depois com dados de teste.

**B3 — BAIXA. Todas as telas são `'use client'` com dados buscados após carregar** (tela em branco "Carregando…" até a sessão e os dados chegarem; duas consultas de sessão antes de cada tela). Medição de tamanho de pacote e Lighthouse **não feita**.

**B4 — BAIXA. Sem paginação** em histórico de produto, movimentos de estoque e extrato. Cresce com o tempo.

---
## C. Confiabilidade

**C1 — ALTA. Pedido duplicado por repetição.** `criar_pedido` não tem chave de idempotência. Se a internet cair depois de o banco gravar e antes da resposta chegar, o garçom vê erro, o rascunho continua na tela e ele reenvia: pedido em dobro (e baixa de estoque em dobro). Também há uma janela mínima de toque duplo antes do botão desabilitar.
- Correção: gerar um UUID por rascunho no navegador, enviar em `p_chave`, coluna `pedidos.chave` com índice único; repetir devolve o pedido existente.
- Arquivos: `app/garcom/page.js`, `lib/pedido.js`, migration nova (substitui `criar_pedido`). Efeito: assinatura da função muda (atualizar testes 001/007).
- Teste: chamar duas vezes com a mesma chave e contar itens/baixas; simular falha de rede.

**C2 — ALTA. Pagamento duplicado por toque duplo.** `registrarPagamento` em `app/caixa/page.js:77` não tem estado "ocupado" nem trava; dois toques rápidos registram dois pagamentos parciais (o saldo só impede ultrapassar o total). Mesmo vale para `fecharConta`, trocar mesa e cancelar. Não há função de **estornar pagamento**, então um erro só se corrige com SQL.
- Correção: estado `ocupado` nos botões (padrão do garçom) + chave de idempotência no pagamento; criar "estornar pagamento" (só dono, com motivo, no histórico).
- Teste: dois cliques em <100 ms em ambiente de teste; função de estorno com testes SQL.

**C3 — MÉDIA. Backup e restauração: não verificados e provavelmente ausentes.** Plano Free não tem backup diário; não existe script de exportação nem teste de restauração. Perda do banco = perda de caixa e histórico.
- Correção: exportação periódica (`pg_dump`/CSV) ou plano Pro; testar restauração em um projeto vazio e registrar o passo a passo.

**C4 — MÉDIA. Sem páginas 404, 500 e de carregamento.** Não existem `not-found.js`, `error.js`, `global-error.js` nem `loading.js` em `app/`. Um erro de execução derruba a tela sem mensagem útil. As telas têm aviso de erro de rede em parte dos casos (`TelaSetor`, `mesas`), mas sem botão de tentar de novo. Correção: criar os arquivos padrão com a identidade visual. Teste: forçar exceção e rota inexistente.

**C5 — MÉDIA. Falhas de conexão sem fila ou aviso persistente.** Sem detecção offline; o tempo real pode cair silenciosamente (só o polling de 15 s cobre). Correção: indicador "sem conexão" no cabeçalho e bloqueio de envio com aviso claro.

**C6 — MÉDIA. Testes cobrem regras puras e SQL, não o conjunto.** 103 testes JS cobrem apenas `lib/` (sem testes de tela ou ponta a ponta); os testes SQL rodam à mão pela ferramenta do Supabase, **sem CI**. Nada impede publicar com teste quebrado. Correção: GitHub Actions rodando `npm test` + `build`; teste ponta a ponta (Playwright) do fluxo pedido → setor → entrega → pagamento → fechamento em projeto de teste.

**C7 — BAIXA. Gatilho de estoque dentro da gravação do pedido.** Se `estoque_baixa` falhar, o pedido inteiro falha (a regra de negócio diz que estoque nunca bloqueia venda). Os testes 007 passam; falta teste de falha forçada. Correção: capturar exceções no gatilho e registrar o aviso.

**C8 — BAIXA. Dados de teste no banco** (mesas 997/998, uma conta fechada de valor zero) poluem relatórios; limpar com autorização antes de usar de verdade.

---
## D. Funcionalidades profissionais ausentes
- Estorno de pagamento e reabertura de conta (erros de caixa hoje não têm saída).
- Fechamento de caixa do dia (conferência de dinheiro, sangria/troco inicial).
- Log de auditoria de mudanças de perfil e da trava (já listado como pendente).
- Monitoramento de erros (ex.: Sentry) e alerta de queda; página de status.
- Backup automatizado e procedimento de restauração testado.
- Dois fatores para o dono; política de senha mais forte.
- Pix, divisão de conta, taxa de serviço (dependem de decisão do dono, ver `DECISOES.md`).
- Troca/devolução de item já entregue (pendente de decisão).
- Aviso sonoro/visual de novo pedido nas telas de setor; modo offline mínimo.
- Exportação de relatórios (CSV) e relatório por garçom e por setor.
- Impressão de comanda como reserva (caso a tela do setor falhe).

## E. Dívidas técnicas e melhorias opcionais
- Telas grandes (`estoque` 466 linhas, `mesas` 337) misturam busca de dados, regras e visual; extrair hooks de dados reutilizáveis (`useTempoReal`).
- `select('*')` em quase todas as consultas.
- Pacote `@supabase/ssr` e leitura no servidor para ganhar velocidade e cookies seguros (muda a arquitetura: só se necessário).
- `AGENTS.md` pede ler a documentação do Next antes de mexer; manter esse hábito.
- Pastas `direcao_visual/` e `wireframe_correção.html` no repositório: mover para `docs/` ou remover do deploy.
- Documentação: unificar `PLANO_PROFISSIONAL.md` com esta auditoria.

---
## Andamento
- **Etapas 1–3 feitas em 25/10/2026** (migration 012, telas e testes): C1, C2 (parte do toque duplo e da repetição; estorno de pagamento ainda falta) e A3. Teste SQL `008_idempotencia_e_tetos.sql`; teste 007 ajustado (vendia 100 unidades, agora 99).
- **Etapa 4 feita em 25/10/2026** (migrations 013 e 014): A1 resolvido. Achado extra: as tabelas de 010/011 tinham permissão de gravação direta para anon e logados (barrada só pela falta de regra RLS), e funções novas nasciam executáveis por todos (PUBLIC). Ambos corrigidos; teste 009. O relatório do Supabase não acusa mais funções abertas ao anônimo; os avisos restantes são esperados (funções chamáveis por logados, que conferem o perfil) e a proteção de senhas vazadas (recurso do plano pago).

- **Etapas 5 a 10 feitas em 25/10/2026:** estorno de pagamento (015, teste SQL 010), páginas 404/erro e aviso de conexão (C4, C5), menos recargas e índices (B1, B2; migration 016), senha mais forte e mensagens de erro traduzidas (A2 em parte, A4), CI no GitHub (C6 em parte), cópia de segurança e restauração (C3 em parte). **Continua em aberto:** teste ponta a ponta no navegador com login (Playwright), monitoramento de erros (precisa de conta num serviço como o Sentry), 2FA do dono e proteção de senhas vazadas (plano pago), backup automático (plano Pro), paginação de históricos longos (B4), C7 (gatilho de estoque) e C8 (limpar dados de teste, com autorização).

## Plano de execução priorizado (etapas pequenas)
| # | Etapa | Teste de validação |
|---|---|---|
| 1 | Travar botões de ação (pagamento, fechar, trocar mesa, cancelar) com estado `ocupado` (C2) | teste de duplo clique em ambiente de teste |
| 2 | Idempotência em `criar_pedido` e `registrar_pagamento` (C1, C2) | SQL: mesma chave duas vezes = um registro |
| 3 | Tetos de quantidade/itens/valor (A3) | SQL com valores extremos |
| 4 | Revogar `anon` das funções e tornar a trava permanente (A1) | chamadas anônimas recusadas; suíte 001–007 |
| 5 | Estorno de pagamento (só dono, com motivo e histórico) (C2/D) | testes SQL + perfis |
| 6 | Páginas 404/erro/carregando e aviso de conexão (C4, C5) | rota inexistente, exceção forçada, modo avião |
| 7 | Backup: exportação agendada + teste de restauração (C3) | restaurar em projeto vazio e conferir contagens |
| 8 | CI no GitHub (testes + build) (C6) | PR com teste quebrado deve falhar |
| 9 | Reduzir recargas e índices (B1, B2) | contagem de requisições antes/depois; `EXPLAIN` |
| 10 | Segurança de senha/2FA, mensagens de erro traduzidas, monitoramento (A2, A4, D) | tentativas de login limitadas; erro simulado chega ao painel |
