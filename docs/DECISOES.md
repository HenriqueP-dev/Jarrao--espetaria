# Decisões, preferências e pendências

Última atualização: 2026-10-22.

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
- Migrations SQL numeradas em `supabase/migrations/` (001 a 003 aplicadas).
- Não publicar, contratar serviços, gastar dinheiro nem fazer commit sem autorização do desenvolvedor.

## 2. Estado do protótipo

Validado à mão em 2026-10-22, com dados fictícios, depois das migrations 001 a 003: pedido do garçom → setores em tempo real → preparo → entrega → cancelamento → pagamento parcial → fechamento da conta. Existem 17 testes automáticos das regras em JavaScript. As funções do banco ainda não têm testes automáticos. Depois, o desenvolvedor também validou à mão a migration 004 (cardápio real, setor garçom, observação e escolha do espeto na jantinha) e confirmou que funcionou.

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
- [Código] (migration 004, ainda não rodada) **Setor "garçom"** para bebidas prontas: o garçom anota e busca, então o item não aparece em tela de preparo e vai de Novo direto para Entregue (marcado em `/mesas`). Decisão informada pelo desenvolvedor; confirmar com o dono.
- [Código] **Meia/inteira** viram dois produtos; **cada sabor** de caipirinha, caipiroska e saqueirinha é um produto; **adicionais** são produtos com preço próprio.
- [Código] **Observação opcional** em cada item (campo `detalhe`), mostrada nos setores, em Mesas e no Caixa. Hipótese de uso: dizer em qual espeto vai o adicional.
- [Código] **Jantinha exige escolher o espeto da casa**; a escolha vai na observação e o pedido segue só para a churrasqueira.
- [Código] Hipóteses de setor a confirmar: doces → churrasqueira; caipiroska e saqueirinha → cozinha (como a caipirinha); adicionais da jantinha e dos espetos → churrasqueira; sucos e águas → garçom.
- [Código] Os produtos fictícios foram **desativados**, não apagados, para o histórico de testes continuar consistente.
- [Código] Fora do cadastro por falta de preço ou informação: salada de rúcula, torresmo, frios, amendoim (meia), 51 Ice (sabores) e Amstel/Eisenbahn/Helles (um preço para três cervejas). Kibe Cru entrou como tamanho único a R$ 15,00.

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
- [Preferência] Mover itens entre pessoas com um botão e confirmação (A3). [Proposta] registrar no histórico e limitar a usuários autorizados. [Pendente] se entra na primeira versão.
- [Preferência] Transferir a conta para outra mesa com botão e confirmação "tem certeza?" (A4). [Pendente] o que fazer se a mesa de destino já tem conta aberta.
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
- [Preferência] Cancelamentos devem ficar claramente visíveis ao setor, para ninguém continuar preparando um item cancelado (C5). [Pendente] como o setor confirma que viu.

### D. Produtos e cardápio
- Cardápio e preços informados pelo desenvolvedor estão em [CARDAPIO.md](CARDAPIO.md). Itens sem preço **não** são cadastrados (nem com valor zero).
- [Fato] Setores: espetos e jantinhas → churrasqueira; batatas, porções, quibes, saladas e caipirinhas → cozinha. Bebidas prontas (D4): segundo o desenvolvedor, os próprios garçons anotam e buscam; no sistema, setor "garçom". [Pendente] confirmar com o dono.
- [Fato] O cardápio tem tamanhos (meia/inteira), sabores e adicionais. O modelo de produtos atual não cobre isso.
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
- [Proposta] Primeiros relatórios: vendas por período, vendas por produto, pagamentos por forma, contas abertas e fechadas, cancelamentos.

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
| Cancelamento | Qualquer pessoa em `/mesas` cancela | Só a dona (exige login e permissões) |
| Cardápio | Resolvido na migration 004 (a rodar): 133 produtos reais, sem os itens sem preço | Cardápio real (apenas itens com preço informado) |
| Produtos | Resolvido na migration 004 (a rodar): categorias, observação, escolha do espeto e setor garçom | Meia/inteira, sabores, adicionais e escolha do espeto na jantinha |
| Aviso no setor | Item cancelado some da lista | Cancelamento visível ao setor |
| Telas dos setores | Lista de itens | Quadro em colunas (Novos, Em preparo, Prontos) |
| Troca de mesa, troca de item, mover item entre pessoas | Não existem | Com confirmação e histórico |
| Quem entregou | Não é registrado (sem login) | Registrar quem marcou Entregue |
| Pix | Fora das formas de pagamento | Provavelmente entra, só como registro manual depois da conferência; confirmar com a dona |
| Fiado | Não existe | Existe na operação; regras pendentes |
| Estoque e relatórios | Não existem | Bebidas e espetos primeiro; relatórios por período |

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
