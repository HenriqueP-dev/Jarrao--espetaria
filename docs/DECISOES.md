# Decisões, preferências e pendências

Última atualização: 2026-10-24.

Referências: [CONTEXTO_DO_PROJETO.md](CONTEXTO_DO_PROJETO.md) (como o restaurante funciona) · [CARDAPIO.md](CARDAPIO.md) (produtos e preços informados) · [PLANO_PROFISSIONAL.md](PLANO_PROFISSIONAL.md) (o que falta para o uso real) · [PERGUNTAS_PENDENTES.md](PERGUNTAS_PENDENTES.md) (perguntas originais).

## Aviso importante

**Nada aqui foi aprovado pelo dono do restaurante.** O projeto ainda não foi apresentado a ele. As respostas abaixo vieram do desenvolvedor (que trabalha como garçom e respondeu como conhece a operação). Tudo precisa ser confirmado com o dono e a equipe antes do uso real.

## Legenda

- **[Fato]**: como o restaurante funciona hoje, segundo o desenvolvedor.
- **[Preferência]**: o que o desenvolvedor quer do sistema.
- **[Proposta]**: sugestão técnica do Claude Code, não decidida.
- **[Código]**: hipótese já implementada no protótipo.
- **[Pendente]**: falta resposta ou confirmação.

---

## 1. Decisões técnicas (tomadas)

- Next.js (telas) + Supabase (banco PostgreSQL e tempo real) + Vercel na publicação futura.
- Estado controlado por item.
- Sem login no protótipo, só com dados fictícios. **Login é obrigatório antes de qualquer uso real.** Segurança fica para depois do protótipo, por decisão do desenvolvedor.
- Migrations SQL numeradas em `supabase/migrations/` (001 a 004 aplicadas e validadas à mão; a 005, de mesa livre, foi escrita em 23/10 e aplicada em 25/10, conferida por consulta de leitura; a 006, de cancelamento visível, lote atômico, troca de mesa e mover item, foi aplicada em 25/10 pela ferramenta de migrations do Supabase e testada; a 007, do relatório de vendas, também; a 008, de login e permissões, foi aplicada em 25/10 **em modo de transição, com a trava desligada**).
- Não publicar, contratar serviços, gastar dinheiro nem fazer commit sem autorização do desenvolvedor.

## 2. Estado do protótipo

Validado à mão em 2026-10-22, com dados fictícios, depois das migrations 001 a 003: pedido do garçom → setores em tempo real → preparo → entrega → cancelamento → pagamento parcial → fechamento da conta. Depois, o desenvolvedor também validou à mão a migration 004 (cardápio real, setor garçom, observação e escolha do espeto na jantinha) e confirmou que funcionou.

Em 23/10 as telas foram refeitas (Kanban nos setores, nova tela do garçom, Mesas por blocos, Caixa em duas colunas) e a mesa passou a ser livre (1 a 999). Hoje existem **50 testes automáticos** das regras em JavaScript (5 arquivos), todos passando, e o build funciona. As funções do banco ainda não têm testes automáticos. Para as telas refeitas em 23/10 não há registro de validação à mão. Uma consulta de leitura em 24/10 mostrou que a migration 005 ainda não estava no banco (a função `criar_pedido` antiga respondia "Mesa N não existe"). O desenvolvedor aplicou a 005 em 25/10 e uma nova consulta confirmou a função nova: mesa 0 e mesa 1000 são recusadas com "Mesa inválida", e nenhum pedido foi gravado no teste. Em 25/10 foi feito um teste das funções do banco **numa transação desfeita** (nada ficou gravado), chamando como o papel público: pedido na mesa 9 aceito (mesa cadastrada na hora, conta aberta, 2 itens, bebida no setor garçom, jantinha na churrasqueira com o espeto na observação, 3 eventos no histórico); mesa 30 aceita; bebida foi de Novo para Entregue; jantinha de Novo para Entregue recusada; jantinha sem espeto recusada. A tela `/garcom` também aceitou um pedido real na mesa 998 (fora das 22).

Em 25/10, com a migration 006 aplicada, o Claude Code testou **no navegador e no banco** (53 testes em JavaScript, mais os testes SQL de `supabase/tests/`, todos passando): cancelar um item faz o aviso vermelho aparecer sozinho na tela do setor (churrasqueira e cozinha, inclusive para item cancelado já pronto); "Ciente" tira o aviso e grava `cancelamento_visto` no histórico; "Iniciar preparo" e "Pronto" agem em lote; trocar a conta de mesa e mover um item para outra pessoa funcionam com confirmação; o caixa mostra o histórico da conta; a conta de teste foi fechada pelo caixa com total zero. Esse teste deixou no banco as mesas 997 e 998 cadastradas e uma conta de teste fechada (mesa 997, sem valor, sem pagamento): ignorar em relatórios futuros. Não testado pela tela: o botão "Entregue" em lote de `/mesas` (a função do banco foi testada), a recusa de troca para mesa com conta aberta pela tela (testada no banco) e o uso em celular real.

Depois, a tela `/vendas` (relatório) foi conferida no navegador com os dados reais, em computador e em celular simulado: os totais (R$ 2.136,00 vendidos e recebidos, 26 contas pagas, 2 cancelamentos) batem com uma conta feita direto nas tabelas, a dica ao passar o mouse funciona, o menu de seis itens cabe no celular, e o teste SQL `003_relatorio_vendas.sql` passou.

Depois, o **login e as permissões** (migration 008) foram testados, **ainda com a trava desligada**: os testes SQL 001 a 003 continuaram passando sem alteração (o sistema aberto não mudou), o novo `004_login_permissoes.sql` simula cada perfil com a trava ligada dentro de uma transação desfeita (sem login, sem perfil, desativado, garçom, churrasqueira, cozinha, caixa, dono, autor no histórico, último dono protegido e desligar a trava) e passou inteiro, e 82 testes em JavaScript cobrem as regras de tela (porteiro, menu, mensagens). No navegador, em modo aberto: menu, tela inicial, entrar, equipe, garçom, caixa e vendas funcionam, a tela de entrar cabe no celular. Consultas de leitura com a chave pública mostraram que gravar direto nas tabelas e ligar a trava sem estar logado são negados. **Validado à mão pelo desenvolvedor em 25/10, com a trava ligada e as 4 contas de teste (dono, garçom, cozinha e churrasqueira):** o login funciona, o botão "Exigir login de todos" funciona depois da correção da migration 009, o dono e o garçom usaram o sistema (o histórico gravou os dois como autores) e as contas da cozinha e da churrasqueira veem apenas o que o perfil delas deveria ver. **Ainda não testado:** celular real, uso simultâneo de várias pessoas, recuperação de senha (não existe) e o cadastro livre de usuários, que continua a desativar no painel do Supabase.

## Identidade visual

- [Fato] Logo e paleta fornecidos pelo desenvolvedor (preto `#0B0B0B`, amarelo `#FFD83D`, vermelho `#E53935`, branco `#F5F5F5`, cinza-escuro `#242424`, cinza `#A3A3A3`). Não confirmados pelo dono.
- [Preferência/Código] **Tema claro** (pedido do desenvolvedor: o escuro ficou pesado). Fundo bege claro, cartões brancos, destaque em laranja queimado (`#C2410C`), amarelo da marca em contadores e estados, verde só em "Pronto". O preto ficou só numa faixa fina no topo, porque o logo tem fundo preto. Cores novas (fundo, laranja queimado, tons de cinza) são minhas, não confirmadas pelo dono. Definidas em `app/globals.css`; logo e ícones em `public/` e `app/` (os ícones são os espetos recortados do logo).
- [Código] Vermelho só para cancelado, erros e ações críticas; nunca para "novo". Estados: Novo = contorno amarelo, Em preparo = amarelo cheio, Pronto = verde, Entregue = cinza, Cancelado = vermelho.
- [Código] O **verde** (`#43A047`, o verde do espeto do logo) foi acrescentado só para "Pronto". Não faz parte da paleta oficial; trocar se o dono preferir.
- [Código] Títulos em Bebas Neue (letras condensadas parecidas com as do logo) e texto em Inter, carregados pelo Next.js.
- [Código] Menu fixo no topo com o logo; no celular as cinco telas cabem na tela. Dá para adicionar o app à tela inicial do celular (manifesto).

### Direção visual dos wireframes (`direcao_visual/`)

- [Preferência] Os 4 wireframes (garçom, cozinha, churrasqueira, caixa) são a referência de **estrutura e hierarquia**: busca, abas por estado com contagem, ticket grande por mesa, observação em caixa tracejada, botões grandes, barra fixa de envio no celular, caixa em duas colunas. As cores continuam as da marca (os wireframes são cinza de propósito).
- [Código] Aplicado em `/cozinha` e `/churrasqueira` (`TelaSetor`), `/garcom` (barra fixa com total e botão enviar; selo de quantidade em cada produto), `/mesas` (indicadores e cartões com total e "prontos") e `/caixa` (lista de contas + extrato com total grande e "falta receber").
- [Código] Ticket agrupado por mesa, do pedido mais antigo ao mais novo. **Hipótese:** o tempo de espera muda de cor aos 10 min (amarelo) e 20 min (vermelho). Aqui o vermelho é alerta de espera longa, não o estado "Novo"; as faixas são palpite e precisam ser validadas com a equipe.
- [Preferência/Código] **Ficha única por mesa** (`direcao_visual` + `wireframe_correção.html`): cada mesa é um só cartão com todos os itens ativos dela, mesmo quando a aba ou a busca casa com só um item. Cada item tem uma caixa para marcar como Pronto, e um botão age na mesa inteira ("Iniciar preparo da mesa", "Marcar mesa como pronta"). O estado continua **por item** no banco; o botão só aplica a mudança a todos os itens que ainda podem mudar.
- [Preferência/Código] **Mesa e pessoa em um campo só** (decisão do desenvolvedor, 2026-10-23): o garçom digita `12` ou `12/João` (mesa, barra, nome). Acabaram os botões numerados 1–23, porque às vezes o restaurante empresta mesas do vizinho e o número passa de 23. O número da mesa é livre, de 1 a 999 (inclusive o 9). A tela Mesas lista só as mesas com conta aberta. Cada pedido tem uma única pessoa; para outra pessoa da mesma mesa, lança-se outro pedido (`12/Maria`). Exige a **migration 005** no Supabase (a função `criar_pedido` antiga só aceitava 1–8 e 10–23); aplicada em 25/10. [Pendente] o que fazer se o nome vier escrito de formas diferentes (`joao`, `João`): hoje são tratados como pessoas diferentes.
- [Preferência/Código] **Entrega na tela Mesas com um botão só**: "Entregue (N itens)" entrega de uma vez tudo o que a churrasqueira e a cozinha já marcaram Pronto, mais as bebidas do setor garçom (que vão de Novo direto para Entregue). Itens ainda em preparo não entram. O estado continua por item no banco. "Cancelar" segue por item, separado, para não ser tocado por engano.
- [Pendente] Nome do garçom no cabeçalho da ficha: não há login, então o sistema não sabe quem lançou (depende de F5). Observação geral da mesa: hoje a observação é por item; não existe campo de observação da mesa. "Ponto da carne" continua dentro da observação do item, sem campo próprio.
- [Preferência/Código] **Mesas separada em Bebidas, Espetos e Cozinha** (pedido do desenvolvedor, 2026-10-23): os itens da conta aparecem em três blocos, pelo setor do cadastro (garçom = Bebidas, churrasqueira = Espetos, cozinha = Cozinha). Há uma barra com **três botões de entregar, um por bloco, lado a lado**; cada um entrega só o que já está pronto naquele bloco (as bebidas não passam por preparo). Substituiu o botão único. O bloco "Espetos" também inclui jantinhas, doces e adicionais da churrasqueira. Item de setor desconhecido vai para "Outros".
- [Preferência/Código] **Tela do garçom refeita** (2026-10-23): o pedido do cliente fica num **painel próprio** (ao lado no computador; folha que sobe pela barra de baixo no celular), separado do cardápio, para não confundir o que o cliente pediu com os resultados da busca. A busca mostra "N resultado(s) para …, não são itens do pedido"; produto já pedido fica destacado com "N no pedido". Categorias numa faixa que rola de lado; textos de ajuda e numeração dos títulos foram removidos; observação por item só aparece ao tocar em "+ observação".
- [Preferência/Código] **Kanban de verdade** em `/cozinha` e `/churrasqueira` (pedido do desenvolvedor, 2026-10-23): as abas que trocavam de página foram removidas. As três colunas ficam à vista ao mesmo tempo; no celular rolam para o lado. Cada mesa é uma ficha em **uma só coluna**, pela fase do item menos adiantado: se ainda há item novo, fica em Novos; senão, se há item em preparo, em Em preparo; senão em Prontos. O tempo da ficha conta a partir do item mais antigo que ainda não está pronto. A busca continua (esvazia as colunas que não casam). Não há arrastar-e-soltar: o botão grande da ficha é que a move. O quadro é **compacto** de propósito (textos e espaços pequenos, cabeçalho da ficha em uma linha: mesa, hora e minutos de espera) para caber mais fichas na tela; só o botão de ação segue grande (52 px), por causa de mão suja e tela com gordura. Tamanhos são palpite, a validar na churrasqueira de verdade.
- [Preferência/Código] O "Resumo em tempo real" dos wireframes foi **removido** das telas de setor, a pedido: o foco é nos pedidos a preparar. Cada ficha tem **um único botão grande** que muda conforme a fase ("Iniciar preparo" → "Pronto ✓"), sem botões extras para a mesma ação. Churrasqueira e cozinha continuam sendo duas telas, cada uma com os itens do seu setor (a jantinha segue só na churrasqueira). A caixa de marcar por item continua como atalho para marcar um item como pronto.
- **Não adotado dos wireframes** (contradiz regras já registradas ou não foi decidido): delivery/balcão/retirada; taxa de serviço de 10% (B3: não há taxa); divisão por nº de pessoas (A2: fica para depois); Pix no resumo do dia (B1 pendente); "20 mesas" e mesa 09 (são 22 mesas, sem a 9); setor "Bar", "Fritadeira"/"Chapa" como subsetores (setor vem do cadastro); reimprimir via; pausar produto por estoque (C3 pendente); alarme sonoro; botão de voltar o item um estado; relatórios de faturamento. Podem entrar depois, se forem decididos.

## 3. Hipóteses implementadas no código (a validar)

- [Código] Estados do item: Novo → Em preparo → Pronto → Entregue, mais Cancelado. Pode pular de Novo direto para Pronto. Cancelar é possível até antes de Entregue.
- [Código] A entrega é registrada pelo garçom na tela Mesas; os setores só marcam Em preparo e Pronto.
- [Código] Cada linha do pedido (ex.: "2x espeto de carne") tem um único estado.
- [Código] Uma conta aberta por mesa, aberta no primeiro pedido.
- [Código] Preço, nome e setor são copiados para o item no momento do pedido (mudar o cadastro não altera registros antigos).
- [Código] Itens cancelados não entram no total.
- [Código] Pagamento parcial permitido, com mais de um pagamento por conta (dinheiro, débito, crédito).
- [Código] Sem troco no registro: o valor registrado não passa do saldo.
- [Código] Fechar a conta exige itens Entregues ou Cancelados e conta paga por completo.
- [Código] Não é possível cancelar item de conta que já tem pagamento.
- [Código] Pix ainda não está nas formas de pagamento.
- [Código] O pagamento é registro manual, não confirmação da maquininha.
- [Código] (migration 004, aplicada e validada) **Setor "garçom"** para bebidas prontas: o garçom anota e busca, então o item não aparece em tela de preparo e vai de Novo direto para Entregue (marcado em `/mesas`). Decisão informada pelo desenvolvedor; confirmar com o dono.
- [Código] **Meia/inteira** viram dois produtos; **cada sabor** de caipirinha, caipiroska e saqueirinha é um produto; **adicionais** são produtos com preço próprio.
- [Código] **Observação opcional** em cada item (campo `detalhe`), mostrada nos setores, em Mesas e no Caixa. Hipótese de uso: dizer em qual espeto vai o adicional.
- [Código] **Jantinha exige escolher o espeto da casa**; a escolha vai na observação e o pedido segue só para a churrasqueira.
- [Código] Hipóteses de setor a confirmar: doces → churrasqueira; caipiroska e saqueirinha → cozinha (como a caipirinha); adicionais da jantinha e dos espetos → churrasqueira; sucos e águas → garçom.
- [Código] Os produtos fictícios foram **desativados**, não apagados, para o histórico de testes continuar consistente.
- [Código] Fora do cadastro por falta de preço ou informação: salada de rúcula, torresmo, frios, amendoim (meia), 51 Ice (sabores) e Amstel/Eisenbahn/Helles (um preço para três cervejas). Kibe Cru entrou como tamanho único a R$ 15,00.
- [Código] (migration 006) **Cancelamento visível ao setor, hipótese a confirmar com a equipe:** o item cancelado sai da fila e aparece num quadro vermelho no topo da tela da cozinha ou da churrasqueira ("Cancelado: não preparar") até alguém tocar em **"Ciente"**; isso grava o evento `cancelamento_visto`. Vale para qualquer item cancelado do setor, mesmo já pronto. Bebidas (setor garçom) não têm tela de setor.
- [Código] (006) **Troca de mesa, hipótese:** a conta inteira passa para outra mesa (1 a 999), com confirmação em dois passos e evento `mesa_trocada`. É **recusada se a mesa de destino já tem conta aberta** (nada é misturado) e se a conta já está fechada.
- [Código] (006) **Mover item entre pessoas:** botão "Pessoa" em cada item de `/mesas`, com confirmação e evento `item_pessoa_alterada` (nome antigo e novo). Vale para item não cancelado de conta aberta; nome em branco tira a pessoa. Sem restrição de quem pode fazer, por falta de login.
- [Código] (006) Mudar vários itens de uma vez (botões da ficha e "Entregue" por bloco) é **tudo ou nada**: se um item não puder mudar, nenhum muda.
- [Código] (006) Limites de tamanho: pessoa até 60 letras, observação até 200.
- [Código] Em `/mesas`, "Em andamento" conta só o que a cozinha e a churrasqueira ainda fazem, e "Para entregar" inclui as bebidas ainda não entregues (antes o rótulo "Em preparo" contava também esses itens).
- [Código] Segurança, relatório do Supabase de 25/10: as 8 funções de gravação (`criar_pedido`, `mudar_estado_item`, `mudar_estado_itens`, `confirmar_cancelamento`, `trocar_mesa`, `mudar_pessoa_item`, `registrar_pagamento`, `fechar_conta`) são executáveis sem login (papel `anon`). É esperado no protótipo e fica para a etapa de login, junto com o autor em cada evento.
- [Pendente] **Troca de um item por outro** (A5) não foi feita: o exemplo do desenvolvedor é com o pedido já entregue na mesa, e hoje item entregue não pode ser cancelado. Precisa de decisão do dono sobre o destino do item entregue (perda, cobrança, estoque).
- [Pendente] **Cadastro de produtos por tela** adiado de propósito: sem login, qualquer pessoa com o endereço poderia mudar preços.
- [Código] (migration 007, tela `/vendas`) **Primeira versão do relatório de vendas, hipóteses a confirmar com o dono:** "vendido" = itens não cancelados das contas **fechadas pelo caixa** no período; o dia de uma venda é o **dia do fechamento da conta**, no horário de Brasília (um expediente que passa da meia-noite é dividido em dois dias); "recebido" = pagamentos registrados no período, por forma; cancelamentos = itens cancelados no período, de qualquer conta; ticket médio = vendido ÷ contas pagas (contas de total zero não contam). Períodos: hoje, ontem, 7 dias, 30 dias, este mês, este ano ou datas escolhidas; acima de 62 dias o gráfico agrupa por mês. Mostra total, ticket médio, recebido, cancelados, gráfico por dia, 10 mais vendidos (por quantidade), formas de pagamento e versões em tabela. Contas abertas não entram. Não inclui lucro (faltam os custos), por garçom, por setor, nem exportação.
- [Pendente] O relatório de vendas, como o resto, está **sem login**: qualquer pessoa com o endereço vê os números. Restringir aos donos na etapa de login (F3). [Código] Resolvido na 008 para quando a trava estiver ligada: só caixa e dono veem o relatório e os pagamentos.
- [Código] (migration 008, tela `/entrar`, `/equipe`) **Login e permissões em modo de transição, hipóteses de permissão a confirmar com o dono:**
  - **Trava desligada (como está hoje):** nada muda para a equipe. Quem já estiver logado tem o nome gravado no histórico. **Trava ligada:** só entra quem tem login e perfil ativo, e cada função do banco confere o perfil de quem chama (não só a tela). Ligar e desligar é reversível, em `/equipe` (só o dono) ou por um UPDATE em `configuracao`.
  - **Matriz:** garçom lança pedido, entrega, troca mesa e move item; cozinha e churrasqueira preparam e dão "Ciente" só nos itens do próprio setor; caixa faz tudo do atendimento e também cancela, recebe, fecha conta e vê vendas e pagamentos; dono faz tudo e gerencia a equipe e a trava. **Cancelar item é só do caixa e do dono** (a dona cancela). Garçom e setores não leem pagamentos nem o relatório.
  - **Perfis ficam numa tabela do banco** (`perfis`), não em dados editáveis pelo próprio usuário (nada de `user_metadata`), então desativar alguém vale na hora. O sistema nunca fica sem dono ativo.
  - **Como ligar com segurança (passo a passo):** (1) o dono cria o próprio acesso em Supabase → Authentication → Users → Add user; (2) o Claude Code dá o perfil de dono a esse usuário (precisa do e-mail e do nome); (3) desativar o cadastro livre de novos usuários em Supabase → Authentication (para estranhos não criarem contas); (4) o dono entra em `/entrar`, cria os acessos da equipe no painel do Supabase e define o perfil de cada um em `/equipe`; (5) cada pessoa testa o próprio login; (6) com aprovação do dono, ligar a trava em `/equipe`. Para voltar atrás: "Voltar ao modo aberto" em `/equipe`.
  - [Pendente] **Troca da senha do banco** (foi colada numa conversa), recuperação de senha por e-mail, e registrar no histórico quem mudou perfis. [Pendente] Garçom registrar pagamento de conta fechada na mesa (B5) não é permitido hoje: só caixa e dono.
  - O relatório de segurança do Supabase continua avisando que as funções de gravação são chamáveis pela API (anon e usuários logados): é esperado, cada uma confere o perfil por dentro (testado).
- [Código] (migration 009) **Erro "UPDATE requires a WHERE clause" ao clicar em "Exigir login de todos", achado pelo desenvolvedor em 25/10:** a API do Supabase carrega a extensão `safeupdate` e recusa `UPDATE`/`DELETE` sem `WHERE`; a função `definir_login_obrigatorio` da 008 atualizava `configuracao` sem `WHERE`. Corrigido na 009 (`where id = true`). Os testes SQL rodam como administrador, onde essa proteção não existe, e por isso não pegaram o erro; o teste `supabase/tests/005_updates_com_where.sql` agora varre o código de todas as funções (com um controle que prova que o detector acusa o erro) e confirma que o dono liga e desliga a trava. A trava continuou desligada o tempo todo. Nenhuma outra função tinha o problema (15 `UPDATE`s conferidos).
- [Código] (migration 010, tela `/produtos`) **Cadastro de produtos, hipóteses a confirmar com o dono:** só o **dono** cadastra e edita (mesmo com a trava desligada); preço de R$ 0,01 a R$ 5.000,00; nome único (sem diferenciar maiúsculas); mudança de preço pede confirmação em dois passos; toda alteração fica em `produtos_historico` com o autor; produto desativado some do cardápio mas não é apagado; pedidos antigos mantêm o preço e o setor da época. Substitui o pendente "cadastro por tela adiado".
- [Código] (migration 011, tela `/estoque`) **Estoque, hipóteses a confirmar com o dono:** só vale para produtos que o dono marca como controlados; a venda dá baixa automática; o estorno só acontece se o item é cancelado ainda como "novo"; **o estoque nunca bloqueia venda** (saldo pode ficar negativo e aparece em alerta); entrada por unidade ou por embalagem (3 caixas × 15 = 45); perda, consumo interno e contagem (ajuste) são lançados por caixa ou dono; só o dono define o que é controlado, as embalagens e o mínimo; cada movimento guarda quem fez. Fora do escopo: doses, receitas/ficha técnica, custo.
- [Código] (tela `/senha`) **Troca da própria senha** (mínimo 8 caracteres). Recuperação por e-mail **não** foi feita, por decisão do desenvolvedor: se alguém esquecer, o dono redefine pelo painel do Supabase.
- [Código] **Passada de segurança (25/10/2026):** cabeçalhos de segurança em `next.config.mjs` (nosniff, anti-iframe, política de referência, permissões; CSP e HSTS só em produção). A CSP permite `'unsafe-inline'` em script/estilo porque o Next.js precisa; uma CSP com nonce deixaria todas as páginas dinâmicas (melhoria futura). Next.js atualizado para 16.4.3; `npm audit` sem vulnerabilidades. Com a trava ligada, os anônimos não leem nem gravam nada (conferido pela API pública).
- [Código] **Cadastro livre desligado** pelo desenvolvedor e conferido pela API pública em 25/10/2026 (`disable_signup: true`). Histórico: antes disso a consulta pública às configurações do Supabase Auth ainda retornou `disable_signup: false` (qualquer pessoa pode se cadastrar). Mesmo cadastrada, a pessoa não tem perfil e não acessa nada com a trava ligada, mas o ideal é desligar: Supabase → Authentication → Sign In / Providers → desmarcar "Allow new users to sign up" e salvar.
- [Código] (migration 012, auditoria de 25/10/2026, etapas 1–3) **Repetição segura e tetos, hipóteses a confirmar com o dono:**
  - **Botões travados durante a ação** (garçom, caixa, mesas, cozinha/churrasqueira, estoque, produtos): toque duplo não repete a chamada (`lib/trava.js`, `app/componentes/useTrava.js`).
  - **Pedido e pagamento com chave de repetição** (`pedidos.chave`, `pagamentos.chave`, únicas): a tela manda a mesma chave enquanto o envio não der certo; se a internet cair depois de o banco gravar e a pessoa tocar de novo, nada é gravado em dobro (nem a baixa de estoque). Sem chave, funciona como antes.
  - **Tetos:** quantidade de 1 a 99 por linha (também como `CHECK` na tabela), até 60 linhas por pedido, pagamento de até R$ 50.000,00. Valores propostos pelo Claude Code, ainda não aprovados pelo dono.
- [Pendente] Não testado no navegador (precisa de login real): telas `/produtos`, `/estoque`, `/senha`. Testado: funções do banco (testes SQL 001–007), regras em JS (103 testes) e build.

---

## 4. Respostas por tema

### Interface e fluxo de pedidos
- [Preferência] Interface simples, parecida com um quadro Kanban: colunas Novos pedidos, Em preparação e Prontos. Deve continuar legível com muitos pedidos ao mesmo tempo.
- [Preferência] Sem tela exclusiva de status para cada garçom. Prioridade é facilitar os setores e o lançamento pelos garçons.
- [Fato] Hoje, pedidos prontos às vezes esperam porque não há garçom disponível.
- [Fato] Jantinha: o pedido aparece na churrasqueira, que pede verbalmente à cozinha a montagem do prato. Sem segunda ordem digital para a cozinha.
- [Fato] A jantinha leva um espeto do cardápio da casa. [Preferência] O sistema deve permitir selecionar qual espeto foi escolhido.

### A. Contas e separação por pessoa
- [Fato] Hoje: separa por nome quando os itens estão bem identificados; se a identificação está incompleta, o garçom pede o total e subtrai na mesa com o pessoal. A divisão usa a calculadora da maquininha.
- [Preferência] Uma conta por mesa com vários pagamentos e saldo restante (A1). [Pendente] confirmar com o dono e o caixa.
- [Preferência] Divisão detalhada de itens compartilhados no sistema fica para depois do protótipo (A2).
- [Preferência] Mover itens entre pessoas com um botão e confirmação (A3). [Proposta] registrar no histórico e limitar a usuários autorizados. [Código] Implementado em `/mesas` (006), com confirmação e histórico, sem restrição de quem pode por falta de login.
- [Preferência] Transferir a conta para outra mesa com botão e confirmação "tem certeza?" (A4). [Código] Hipótese implementada (006): a troca é recusada se a mesa de destino já tem conta aberta. [Pendente] confirmar com o dono.
- [Preferência] Trocar um item por outro depois de enviado, com confirmação; o novo item vai direto ao setor correto (A5). Exemplo: 2 carnes e 1 frango, trocar 1 carne por 1 tulipa, com o pedido já na mesa. O sistema deve registrar o ajuste do item antigo e o novo lançamento. [Pendente] o que acontece com o item antigo já preparado ou entregue (perda, reaproveitado, estoque).
- [Preferência] Nomes de clientes: só o nome da pessoa, sem descrições físicas ou apelidos (H3).

### B. Caixa e pagamentos
- [Fato] Maquininha Stone. Aceita Pix por QR Code, débito e crédito. O desenvolvedor acredita que passa mais algum tipo de cartão, sem certeza (B1). [Pendente] confirmar com a dona.
- [Fato] Confirmação do recebimento: o garçom mostra o comprovante (Pix, débito ou crédito) ao caixa, que confere com a maquininha e com o valor. O sistema só registra depois da conferência; nunca presumir que um pagamento foi recebido.
- [Fato] O caixa é a dona.
- [Fato] Troco: o caixa calcula e entrega, fora do sistema (B2). [Preferência] manter assim. O sistema mostra o total da conta ao caixa para evitar cálculo de cabeça (a tela `/caixa` já faz isso). Troco não é registrado.
- [Fato] Não há taxa de serviço (B3). Não adicionar automaticamente.
- [Fato] Cortesias (por exemplo, aniversário) são decididas pelos donos (B4). [Pendente] procedimento hoje. [Proposta] registrar motivo, valor e responsável, preservando o preço original.
- [Fato] Existe **fiado** para familiares, conhecidos, funcionários de lojas vizinhas e clientes frequentes autorizados pelos donos, pago no mesmo dia ou no dia seguinte (B6). [Pendente] como é registrado hoje, se há limite, quem pode autorizar. Não implementado.
- [Fato] A dona guarda os comprovantes e faz a contagem no fim do dia (B7). [Proposta] no futuro, um resumo por forma de pagamento para ajudar na conferência, sem substituir comprovantes nem maquininha.
- [Pendente] Quem registra o pagamento quando o garçom fecha a conta na mesa (B5).

### C. Cancelamentos e correções
- [Fato] Só a dona é responsável por cancelamentos (C1).
- [Fato] Na prática, o garçom avisa o setor verbalmente ("mesa 16 não pediu, pode tirar") e o setor às vezes repassa o espeto para outro pedido (C2). [Pendente] esclarecer a relação: a dona autoriza o cancelamento na conta e o garçom só avisa o setor?
- [Fato] Não há regra consistente para perdas. Não contar todo cancelamento como perda. [Proposta] registrar motivo e situação do preparo; a baixa de estoque dependerá de regras futuras.
- [Fato] Reclamações de item não entregue: a dona chama os garçons que levaram e pergunta; não há registro de quem entregou; costuma gerar discussão; às vezes os donos absorvem o prejuízo. Como isso é anotado hoje: o desenvolvedor não tem certeza.
- [Preferência/ideia] O sistema registrar **quem** marcou o item como Entregue, para esclarecer essas situações. Depende de login.
- [Fato] Pedido feito errado: não é registrado; o funcionário avisa o dono, que decide (às vezes manda outro espeto, geralmente sem desconto) (C4). O sistema não presume desconto nem perda.
- [Fato] Produto indisponível: avisado verbalmente aos garçons (C3). [Preferência/ideia] marcar o produto como indisponível no sistema; a churrasqueira poderia marcar (exemplo: Romeu e Julieta); possivelmente automático quando o estoque chegar a zero. [Pendente] confirmar essa interpretação e quem terá a permissão.
- [Preferência] Cancelamentos devem ficar claramente visíveis ao setor, para ninguém continuar preparando um item cancelado (C5). [Código] Hipótese implementada: botão "Ciente" no quadro de cancelados da tela do setor (006). [Pendente] confirmar com a equipe.

### D. Produtos e cardápio
- Cardápio e preços informados pelo desenvolvedor estão em [CARDAPIO.md](CARDAPIO.md). Itens sem preço **não** são cadastrados (nem com valor zero).
- [Fato] Setores: espetos e jantinhas → churrasqueira; batatas, porções, quibes, saladas e caipirinhas → cozinha. Bebidas prontas (D4): segundo o desenvolvedor, os próprios garçons anotam e buscam; no sistema, setor "garçom". [Pendente] confirmar com o dono.
- [Fato] O cardápio tem tamanhos (meia/inteira), sabores e adicionais. [Código] Resolvido na migration 004: cada tamanho e cada sabor é um produto, e adicionais são produtos com preço próprio.
- [Pendente] Quem pode alterar preços (D2). [Proposta] só o dono ou administrador. O preço de um pedido já lançado permanece registrado.

### E. Estoque
- [Preferência] Começar com **bebidas e espetos** (principalmente os especiais, comprados uma vez por semana ou a cada duas semanas). Futuramente, todo o cardápio e outros insumos (carvão, ingredientes). Limpeza e escritório ficam fora; podem virar outro sistema.
- [Preferência] Entradas por caixa, fardo ou unidade, com conversão (exemplo: 3 caixas × 15 = 45 unidades) e baixa automática quando o pedido é lançado. [Pendente] como a baixa reage a cancelamentos e trocas. [Pendente] quantidades reais por embalagem.
- [Fato] Hoje não há contagem de perdas, consumo interno nem inventário (E3). [Proposta] registrar entradas, vendas, perdas, consumo interno e ajustes, com motivo e responsável.
- [Fato] Quem registra: os donos, ou alguém da churrasqueira que confere os espetos. O dono faz as compras e traz a mercadoria. As quantidades de espetos são pequenas (2 a 5 pacotes) (E4).
- [Preferência] Futuramente controlar carne, batata, bebidas e **doses** (por exemplo, Velho Barreiro usado em dose e em caipirinhas). [Fato do projeto] Não baixar ingredientes por receita antes de definir receitas, quantidades e unidades.

### F. Usuários e permissões
- [Preferência] Perfis: garçons, caixa/dona, cozinha, churrasqueira e donos/administradores. Quem mais usa: caixa e garçons.
- [Preferência] Logins individuais; para novatos, acesso temporário. [Proposta] em vez de senha compartilhada, criar um acesso individual temporário por pessoa (ex.: válido por um dia), para manter o rastreio. Senhas compartilhadas impedem saber quem fez cada ação.
- [Fato] Há alta rotatividade, com alguns funcionários há 3 ou 4 anos.
- [Preferência] Aparelhos: celular para cada garçom (próprio ou comprado pelos donos, tamanho médio); notebook atual no caixa; tablet ou tela de LED de tamanho médio na cozinha e na churrasqueira. Interface precisa funcionar em celular e telas maiores. [Pendente] confirmar com o dono quais aparelhos existem.
- [Fato] Os donos trabalham à noite e precisam consultar relatórios fora do restaurante e do horário. [Pendente] quais ações administrativas poderão ser feitas remotamente (F3).
- [Fato] Cancelamento: a dona. Desconto e cortesia: os donos. [Pendente] matriz completa de permissões aprovada pelo dono (F4).
- [Preferência] Registrar quem lançou, alterou, cancelou ou recebeu pagamento, com data/hora e valores antes e depois. Serve para o dono consultar o histórico e para o garçom provar o que fez (F5). Nunca apagar registros silenciosamente. [Proposta] avisar a equipe de que as ações são registradas.

### G. Relatórios
- [Preferência] Valores vendidos por dia, semana, mês e ano, com o máximo de histórico possível.
- [Preferência] Consultar dentro do sistema (inclusive pelo celular). Sem exportar nem imprimir por enquanto.
- [Preferência] Ver lucro. [Proposta] só será confiável depois de cadastrar os custos dos produtos.
- [Proposta] Primeiros relatórios: vendas por período, vendas por produto, pagamentos por forma, contas abertas e fechadas, cancelamentos. [Código] Feitos em `/vendas` (007), exceto "contas abertas e fechadas" como lista; ver as hipóteses na seção 3.

### H. Fiscal, privacidade e retenção
- [Pendente] O desenvolvedor não sabe qual sistema fiscal o restaurante usa (H1) nem como o sistema conviverá com ele (H2). Falar com o dono e o contador.
- [Fato do projeto] O sistema não emite nota fiscal e não substitui o sistema fiscal.
- [Preferência] Guardar registros de vendas pelo maior tempo possível (H4). [Pendente] prazo com o contador, considerando segurança e custo. Não presumir retenção ilimitada.

### I. Operação e rotina
- [Fato] Se o sistema ou a internet falhar, a equipe volta ao papel por pelo menos um dia até resolver. [Proposta] procedimento para reconciliar pedidos feitos no papel e evitar duplicação.
- [Fato] O Wi-Fi não cobre bem todo o restaurante, que é aberto, com mesas distantes. [Pendente] testar a rede nos pontos de uso antes do piloto.
- [Fato] O desenvolvedor é iniciante e não pode prometer resolver qualquer falha na hora. Quer o sistema no ar 24 horas, mas não promete suporte nesse nível.
- [Preferência] O protótipo precisa estar bem finalizado antes de apresentar ao dono. Piloto em paralelo ao papel; duração não definida. O papel só é abandonado com autorização do dono.
- [Preferência] Treinamento curto, em um dia e horário tranquilos no meio da semana.
- [Preferência] Meta pessoal: tentar usar o sistema até o fim de 2026. [Pendente] o dono não aprovou essa data. [Proposta] tratar como meta pessoal; o piloto só começa depois da aprovação do dono.
- [Preferência] Orçamento: começar gratuito. Se for preciso pagar, o ideal é R$ 100 a 150 por mês, com teto de cerca de R$ 200. Ainda não foi apresentado ao dono. O restaurante já tem site e não usa domínio próprio neste projeto.

### J. Infraestrutura técnica
- [Fato] O desenvolvedor precisa de ajuda para escolher plano de hospedagem e banco, separar ambientes de teste e produção, fazer backups e guardar senhas e chaves.
- [Proposta] Antes de contratar qualquer serviço, verificar preços e limites oficiais. Não afirmar que um backup funciona sem testar a restauração.
- [Fato do projeto] Nunca guardar senhas de funcionários em texto aberto nem chaves no Git (o `.env.local` está no `.gitignore`).

---

## 5. Pontos em que as respostas diferem do protótipo atual

| Tema | Protótipo hoje | O que foi pedido |
|---|---|---|
| Cancelamento | Com a trava desligada (hoje) qualquer pessoa cancela; com a trava ligada (008) só caixa e dono | Só a dona (exige login e permissões) |
| Cardápio | Resolvido na migration 004 (aplicada): 133 produtos reais ativos, sem os itens sem preço | Cardápio real (apenas itens com preço informado) |
| Produtos | Resolvido na migration 004 (aplicada): categorias, observação, escolha do espeto e setor garçom | Meia/inteira, sabores, adicionais e escolha do espeto na jantinha |
| Aviso no setor | Resolvido (migration 006): quadro vermelho com botão "Ciente" na tela do setor | Cancelamento visível ao setor |
| Telas dos setores | Resolvido: Kanban com as três colunas lado a lado (Novos, Em preparo, Prontos); no celular as colunas rolam para o lado | Quadro em colunas (Novos, Em preparo, Prontos) |
| Troca de mesa, troca de item, mover item entre pessoas | Troca de mesa e mover item: resolvidos (006), com confirmação e histórico. Troca de item: não existe | Com confirmação e histórico |
| Quem entregou | Pronto na 008: quem está logado fica gravado em todo evento do histórico; sem login, não | Registrar quem marcou Entregue |
| Pix | Fora das formas de pagamento | Provavelmente entra, só como registro manual depois da conferência; confirmar com a dona |
| Fiado | Não existe | Existe na operação; regras pendentes |
| Estoque e relatórios | Relatório de vendas: primeira versão em `/vendas` (007). Estoque: não existe | Bebidas e espetos primeiro; relatórios por período |

## 6. Pendências (precisam de resposta do dono ou da equipe)

1. Preços do cardápio que faltam (listados em [CARDAPIO.md](CARDAPIO.md)) e tamanho do Kibe Cru.
2. Confirmar com o dono que o garçom anota e busca as bebidas prontas (D4), e os setores marcados como hipótese (doces, caipiroska, saqueirinha, adicionais, sucos).
3. Quem altera preços e quem marca produto indisponível (D2, C3).
4. Quem registra pagamento de conta fechada na mesa (B5).
5. Como o fiado é registrado, autorizado e limitado (B6).
6. Procedimento de cortesias e descontos (B4).
7. Mesa de destino já com conta aberta, na troca de mesa (A4).
8. O que acontece com item trocado ou cancelado que já foi preparado ou entregue (A5, C2).
9. Cancelamento: a dona autoriza e o garçom avisa o setor? Como o setor confirma que viu (C1, C5).
10. Matriz de permissões por perfil e ações remotas dos donos (F3, F4).
11. Quantidade por caixa ou fardo e regras de baixa de estoque; doses e receitas (E2, E5).
12. Sistema fiscal usado e convivência com ele (H1, H2).
13. Prazo legal de retenção dos registros (H4).
14. Teste de Wi-Fi nos pontos de uso e equipamentos disponíveis (I2, F2).
15. Duração e critérios do piloto; aprovação do dono, do orçamento e da data (I4, I5, I7).
16. Hospedagem, ambientes, backups e custos reais (J1 a J3).

## 7. Próximos passos sugeridos (nada disso foi iniciado)

1. **Apresentar o projeto ao dono** com o protótipo, para confirmar as pendências acima (não é tarefa de código).
2. Cadastrar o cardápio real, somente com itens de preço confirmado; planejar variações e adicionais.
3. Mostrar o histórico da conta no caixa.
4. Quadro em colunas e aviso de cancelamento nas telas dos setores.
5. Troca de item, troca de mesa e mover item entre pessoas, com histórico.
6. Login, perfis e permissões, registrando quem fez cada ação.
7. Testes automáticos das funções do banco.
8. Relatórios por período, depois estoque de bebidas e espetos.
