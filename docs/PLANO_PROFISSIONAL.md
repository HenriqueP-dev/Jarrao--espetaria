# Plano para colocar o sistema em uso real

Este arquivo lista **tudo o que falta** entre o protótipo atual (dados fictícios, sem login) e um sistema que o restaurante possa usar de verdade, com segurança e confiança. As regras de negócio vêm de [CONTEXTO_DO_PROJETO.md](CONTEXTO_DO_PROJETO.md); decisões e hipóteses ficam em [DECISOES.md](DECISOES.md).

Legenda de quem faz: **[Eu]** = Claude Code escreve e testa · **[Você]** = precisa de você (decisão, conta, acesso ou validação no restaurante) · **[Os dois]**.

Prioridade: **P1** = obrigatório antes do uso real · **P2** = importante, pode vir logo depois · **P3** = melhoria.

---

## 1. Onde estamos hoje

Pronto (com dados fictícios):
- Garçom registra pedido por mesa, com pessoa opcional.
- Itens vão ao setor cadastrado (cozinha ou churrasqueira), em tempo real.
- Estado por item: novo → em preparo → pronto → entregue (ou cancelado).
- Mesas e consumo, histórico da conta.
- Caixa: pagamentos parciais (dinheiro, débito, crédito) e fechamento da conta.
- Testes das regras em JavaScript (17 testes).

Limites conhecidos:
- Sem login: qualquer pessoa com o endereço consegue usar e gravar.
- Produtos só mudam pelo SQL.
- Não existe separação de contas por pessoa, estoque nem relatórios.
- As funções do banco foram testadas à mão, não automaticamente.
- Não é um sistema fiscal (veja o item 6).

---

## 2. Funcionalidades que faltam

| # | Item | Prioridade | Quem |
|---|---|---|---|
| 2.1 | Corrigir os problemas que você observou nas telas (me diga quais) | P1 | Os dois |
| 2.2 | Tela de cadastro e edição de produtos (nome, preço, setor, ativo) | P1 | Eu |
| 2.3 | Histórico da conta também visível no caixa | P1 | Eu |
| 2.4 | Separação de contas por pessoa (total por pessoa, pagar separado) | P2 | Os dois (regras abaixo) |
| 2.5 | Item que acabou: marcar produto indisponível e avisar os garçons | P2 | Os dois |
| 2.6 | Aviso no setor quando um item em preparo é cancelado (hoje ele some da lista) | P2 | Os dois |
| 2.7 | Relatórios: vendas por período, quantidade por produto, contas e pagamentos, cancelamentos | P2 | Eu |
| 2.8 | Estoque: cadastro, entradas, saídas das vendas, perdas e ajustes | P2 | Os dois |
| 2.9 | Pix, se o restaurante aceitar | P2 | Você decide |
| 2.10 | Mover item entre contas ou mesas (cliente trocou de mesa) | P3 | Os dois |
| 2.11 | Troco no pagamento em dinheiro | P3 | Você decide |
| 2.12 | Impressão ou exportação da conta | P3 | Você decide |

### Decisões de negócio que preciso de você (não vou inventar)

Cada pergunta bloqueia o item indicado.

**Contas e caixa**
- (2.4) Na separação de contas: como tratar itens compartilhados (por exemplo, uma porção para a mesa toda)? Dividir igualmente, ou o garçom escolhe quem paga?
- (2.4) Cada pessoa paga uma conta separada, ou o caixa fecha uma conta única com vários pagamentos?
- (2.9) O restaurante aceita Pix? Como o caixa confirma o recebimento hoje?
- (2.11) Como o troco é tratado hoje no caixa?
- Taxa de serviço (10%) é cobrada? Se sim, entra no total?
- Contas grandes fechadas pelo garçom na mesa: o garçom também registra o pagamento, ou só o caixa?

**Cancelamentos e itens**
- Quem pode cancelar um item e em que momento (antes de entrar em preparo, depois)?
- Item cancelado já em preparo vira perda? Isso afeta estoque e relatórios.
- Existe desconto ou cortesia? Quem autoriza?

**Estoque**
- Quais produtos terão controle no começo (só bebidas?)?
- Em que unidade contar (unidade, fardo, caixa)? Como converter fardo em unidades?
- Como registrar perda, consumo interno e inventário?

**Operação**
- Quem usa cada tela e em que aparelho (celular do garçom, tablet na cozinha, computador no caixa)?
- O pedido pode ser editado depois de enviado (aumentar quantidade)? Ou só cancelar e pedir de novo?

---

## 3. Segurança (P1 antes de qualquer uso real)

Hoje as tabelas permitem leitura por qualquer pessoa com a chave pública, e as gravações passam por funções que também são públicas. Isso é aceitável só com dados fictícios.

1. **Login por usuário** (Supabase Auth). **[Eu]** com decisões suas: quem entra com e-mail e senha, quem tem PIN no tablet compartilhado.
2. **Papéis**: garçom, cozinha, churrasqueira, caixa, dono/administrador. **[Os dois]**
   - Garçom: criar pedido, ver mesas, marcar entregue.
   - Cozinha e churrasqueira: ver só o seu setor, marcar em preparo e pronto.
   - Caixa: registrar pagamento e fechar conta.
   - Administrador: cadastros, relatórios, cancelamentos com autorização.
3. **Regras de acesso no banco (RLS por papel)**, em vez de leitura livre. **[Eu]**
4. **Quem fez o quê**: gravar o usuário em cada evento do histórico. **[Eu]**
5. **Segredos**: a chave `service_role` e a senha do banco nunca vão para o código nem para o GitHub. O `.env.local` já está no `.gitignore`. **[Você]** guarda a senha do banco em um gerenciador de senhas.
6. **Proteção contra abuso**: limitar tentativas de login e revisar permissões das funções. **[Eu]**
7. **Dados pessoais** (nomes de clientes na separação de contas): conferir com um contador ou advogado se há exigência de LGPD para o seu caso. **[Você]**

---

## 4. Banco de dados e ambientes

1. **Dois projetos Supabase**: um de **teste/desenvolvimento** e um de **produção**. Nunca testar no banco de produção. **[Você]** cria a conta/projeto; **[Eu]** configuro.
2. **Migrations versionadas** em `supabase/migrations` (já existe o padrão 001, 002, 003…). Ordem fixa, nunca editar uma migration já aplicada em produção; criar uma nova. **[Eu]**
3. **Backups**: confirmar o plano do Supabase (os backups automáticos e o ponto de restauração dependem do plano pago). Definir a frequência e testar uma restauração. **[Você]** decide o plano; **[Os dois]** testamos.
4. **Dados de teste separados** dos reais: o `seed.sql` só roda no ambiente de teste. **[Eu]**
5. **Limites do plano gratuito**: conferir conexões, tamanho do banco, pausa por inatividade e limites de tempo real para o movimento do restaurante. **[Você]**

---

## 5. Qualidade e testes

1. **Testes automáticos das funções SQL** (pedido, mudança de estado, pagamento, fechamento) em um banco de teste. **[Eu]**
2. **Testes ponta a ponta** do fluxo principal (garçom → cozinha → entrega → caixa). **[Eu]**
3. **Roteiro de teste manual** com casos de movimento: duas mesas pedindo ao mesmo tempo, internet lenta, cancelamento durante o preparo. **[Os dois]**
4. **Checagem automática no GitHub** (testes e build a cada alteração). **[Eu]**
5. **Critérios de aceitação** escritos para cada funcionalidade (o que é "funcionou"). **[Os dois]**
6. **Revisão de código e de segurança** antes de ir ao ar. **[Eu]**

---

## 6. Fiscal e legal (verificar com um contador)

Este sistema **registra** pedidos, contas e pagamentos. Ele **não emite** nota ou cupom fiscal (NFC-e/SAT) e **não substitui** o sistema fiscal que o restaurante já usa, se existir.

- **[Você]** conversar com o contador: o que o restaurante precisa emitir e como o sistema deve conviver com isso.
- Dependendo da resposta, a integração fiscal pode virar um módulo à parte. Não vou assumir nada disso.
- O registro de pagamento é manual e **não é** confirmação da operadora do cartão.

---

## 7. Publicação (deploy)

1. **Repositório no GitHub** (privado). **[Você]** cria; **[Eu]** preparo e, com sua autorização, faço os commits.
2. **Vercel** conectada ao repositório, com as variáveis de ambiente do projeto de **produção** (URL e chave anon). **[Os dois]**
3. **Endereço**: usar o domínio da Vercel no começo; domínio próprio é opcional. **[Você]**
4. **HTTPS**: já vem pela Vercel.
5. **Acesso no celular**: abrir pelo navegador e adicionar à tela inicial. Podemos transformar em PWA (ícone e tela cheia). **[Eu]**
6. **Publicar só com sua autorização.**

---

## 8. Operação no restaurante

1. **Equipamentos**: celulares dos garçons, um tablet ou monitor na cozinha e outro na churrasqueira, computador ou tablet no caixa. **[Você]**
2. **Wi-Fi**: sinal estável em todo o salão e na churrasqueira. **[Você]**
3. **Contingência** (a internet cai): definir o que fazer. A proposta mais simples é voltar ao papel para os pedidos enquanto estiver fora e registrar depois. **[Os dois]**
4. **Treinamento** curto para cada função, com uma folha de instruções. **[Os dois]**
5. **Período de piloto**: usar o sistema **em paralelo com o papel** por alguns dias, comparando contas e totais, antes de abandonar o papel. **[Você]**
6. **Plano de volta**: se algo der errado no meio do movimento, o papel continua disponível. **[Você]**
7. **Quem dá suporte** durante o horário de funcionamento. **[Você]**

---

## 9. Monitoramento e manutenção

1. **Registro de erros** (por exemplo, Sentry no plano gratuito) para saber quando algo quebra. **[Eu]**
2. **Verificação periódica**: quantidade de contas abertas há muito tempo, itens parados em "novo" etc. **[Eu]**
3. **Processo para mudar regras**: registrar a mudança em `DECISOES.md`, criar migration, testar em ambiente de teste, só então publicar. **[Os dois]**
4. **Atualização de dependências** com cuidado (o Next.js muda bastante entre versões). **[Eu]**

---

## 10. Para você aprender e manter o projeto

- Fazer commits pequenos com mensagens claras e usar branches para cada mudança.
- Ler cada migration SQL antes de rodar: ela descreve a regra do negócio no banco.
- Escrever em `DECISOES.md` toda regra confirmada com o restaurante.
- Manter uma lista curta de "erros observados" (o que fez, o que esperava, o que aconteceu).
- Este projeto pode entrar no portfólio. Quando houver login e relatórios, vale gravar um vídeo curto do fluxo completo.

---

## 11. Ordem sugerida

1. **Agora (fechar o protótipo):** corrigir os problemas observados (2.1), cadastro de produtos (2.2), histórico no caixa (2.3), testes do SQL (5.1).
2. **Decidir com o restaurante:** as perguntas da seção 2 e as da seção 6 (contador).
3. **Segurança antes do uso real:** login, papéis e RLS (seção 3), ambiente de produção separado (seção 4).
4. **Complementar:** separação de contas, relatórios, estoque.
5. **Publicar e testar em piloto:** deploy (seção 7), treinamento e uso em paralelo com o papel (seção 8).
6. **Passar para o uso real** só depois que as contas do piloto baterem com o papel.

---

## 12. Checklist final antes do uso real

- [ ] Login e papéis funcionando; leitura livre removida.
- [ ] Ambientes de teste e produção separados.
- [ ] Backup configurado e restauração testada.
- [ ] Testes automáticos do fluxo principal passando.
- [ ] Decisões de negócio da seção 2 respondidas e registradas.
- [ ] Contador consultado sobre a parte fiscal.
- [ ] Equipamentos e Wi-Fi conferidos.
- [ ] Contingência combinada com a equipe.
- [ ] Equipe treinada.
- [ ] Piloto em paralelo com o papel concluído, com as contas conferidas.
- [ ] Alguém responsável por dar suporte no horário de funcionamento.
