# Jarrão Espetaria — informações que faltam para colocar o sistema em uso real

> Este documento é autossuficiente: pode ser colado em outro chat (por exemplo, o ChatGPT) sem mais contexto.

## Como usar este documento (instruções para o assistente)

Sou estudante e estou desenvolvendo, com o Claude Code, um sistema web para o restaurante onde trabalho. O protótipo já funciona com dados fictícios. Para chegar ao uso real, faltam informações e decisões sobre o funcionamento do restaurante, que **só o dono e a equipe podem responder**.

Ajude-me a:

1. Transformar as perguntas abaixo em um **roteiro de conversa curto** que eu possa fazer com o dono, o caixa, os garçons, a cozinha e a churrasqueira (o que perguntar a quem, em linguagem simples).
2. Para cada pergunta, sugerir uma **resposta padrão simples** (usada por restaurantes pequenos) e uma alternativa, deixando claro que são sugestões e não fatos sobre o meu restaurante.
3. Depois, quando eu trouxer as respostas reais, organizá-las no **formato de resposta** do final deste documento, para eu colar de volta no Claude Code.

Não invente fatos sobre o restaurante. Onde houver exigência legal ou fiscal, diga que é preciso confirmar com um contador.

---

## 1. Contexto do projeto (resumo)

**Restaurante:** Jarrão Espetaria, em Barretos–SP. Serve espetos (churrasqueira), jantinhas, batata frita, quibes, saladas, caipirinhas e bebidas.

**Equipe:** cozinha (~4 pessoas), caixa (1), churrasqueira (dono + 1 funcionário), garçons (3 ou 4). Os garçons não têm setor fixo: quem estiver livre atende.

**Mesas:** numeradas de 1 a 8 e de 10 a 23 (não existe a 9). As mesas mudam de lugar fisicamente, por isso a identificação é pelo número.

**Como é hoje (papel):** o garçom anota em caderneta e em papéis que vão para a churrasqueira (ímã em suporte metálico) e para a cozinha (ímã na geladeira). Quando um item fica pronto, avisam por campainha ou verbalmente. Para fechar a conta, o garçom reúne as comandas da mesa, confere se não há item em preparo, leva ao caixa, que calcula; o pagamento é feito normalmente na maquininha. Contas grandes às vezes são fechadas pelo garçom na mesa. Para separar a conta, usam o nome das pessoas nos itens.

**Problemas atuais:** itens consumidos que não são registrados ou cobrados, divergências ocasionais nos valores, dificuldade de investigar nos horários de pico, estoque de bebidas impreciso, sem relatório confiável de vendas por produto.

**Regra especial da jantinha:** o garçom registra, o pedido aparece para a churrasqueira, que prepara o espeto e pede verbalmente à cozinha a montagem do prato. A conversa entre churrasqueira e cozinha continua verbal; o sistema não cria uma segunda ordem digital.

**O que o protótipo já faz (com dados fictícios):**
- O garçom escolhe a mesa, opcionalmente a pessoa, e adiciona itens.
- Cada item vai para o setor cadastrado no produto (churrasqueira ou cozinha), em tempo real.
- Estado por item: novo → em preparo → pronto → entregue (ou cancelado).
- Consulta de mesas e contas, com histórico dos eventos.
- Caixa: pagamentos parciais em dinheiro, débito ou crédito, e fechamento da conta.

**Hipóteses que o sistema adotou e precisam de confirmação:**
- Quem marca "entregue" é o garçom.
- Itens cancelados não entram no total.
- Pagamento parcial é permitido, mas não há troco no registro.
- Para fechar a conta, todos os itens precisam estar entregues ou cancelados e a conta precisa estar paga por completo.
- Não dá para cancelar item de uma conta que já recebeu pagamento.
- O pagamento é um registro manual; não confirma a operadora do cartão.

**Ainda não existe:** login e permissões, separação de contas por pessoa, estoque, relatórios, cadastro de produtos por tela, Pix, impressão da conta, parte fiscal.

---

## 2. Perguntas pendentes

As perguntas estão agrupadas por assunto. Cada uma tem um código para eu poder citar na resposta.

### A. Contas e separação por pessoa

- **A1.** Quando os clientes pedem para separar a conta, cada pessoa paga uma conta própria (um fechamento por pessoa) ou o caixa fecha uma conta única com vários pagamentos?
- **A2.** Como tratar itens compartilhados (por exemplo, uma porção para a mesa inteira)? Dividir por igual entre as pessoas ou o garçom escolhe quem paga?
- **A3.** O cliente pode pedir para mover itens de uma pessoa para outra depois de lançado? Quem pode fazer isso?
- **A4.** Quando o cliente troca de mesa, o que acontece com a conta?
- **A5.** O pedido pode ser editado depois de enviado (por exemplo, aumentar a quantidade) ou só cancelar e pedir de novo?

### B. Caixa e pagamentos

- **B1.** O restaurante aceita Pix? Se sim, como o caixa confirma que o dinheiro entrou hoje?
- **B2.** Como o troco é tratado no pagamento em dinheiro?
- **B3.** Cobra taxa de serviço (10%)? Se sim, é obrigatória, opcional ou sugerida? Entra no total da conta?
- **B4.** Existe desconto ou cortesia? Quem autoriza e como é registrado hoje?
- **B5.** Quando o garçom fecha a conta na mesa, ele também registra o pagamento ou só o caixa registra?
- **B6.** Existe conta "fiado" ou pagamento posterior? Como é controlado?
- **B7.** Existe fechamento de caixa no fim do dia (conferência de dinheiro e cartões)? Quem faz e como?

### C. Cancelamentos, itens indisponíveis e correções

- **C1.** Quem pode cancelar um item? Em quais momentos (antes de entrar em preparo, durante, depois de pronto)?
- **C2.** Item cancelado depois de iniciado vira perda? Isso deve entrar no estoque e nos relatórios?
- **C3.** Quando um item acaba, quem avisa os garçons hoje? Queremos marcar o produto como indisponível no sistema?
- **C4.** Quando um item sai errado ou o cliente reclama, o que a equipe faz (refaz, substitui, desconta)? Como deve ser registrado?
- **C5.** Se um item em preparo for cancelado, o setor precisa ser avisado na tela?

### D. Produtos e cardápio

- **D1.** Lista completa de produtos com **nome, preço, setor de preparo** (churrasqueira, cozinha ou nenhum, como bebidas prontas) e se o produto deve ter controle de estoque.
- **D2.** Quem pode alterar preços e com que frequência?
- **D3.** Existem produtos com variações (por exemplo, caipirinha de limão, de morango) ou adicionais? Como são cobrados?
- **D4.** Bebidas prontas (cerveja, refrigerante) passam pelo sistema? Quem entrega, o garçom ou o caixa?

### E. Estoque

- **E1.** Quais produtos terão controle no começo (somente bebidas)?
- **E2.** Em qual unidade contar: unidade, fardo, caixa? Como converter fardo em unidades?
- **E3.** Como registrar perdas, consumo interno e contagem de inventário? Com que frequência é feita a contagem?
- **E4.** Quem registra a entrada de mercadorias e como confere com a nota do fornecedor?
- **E5.** Os ingredientes de pratos (carne, batata, etc.) devem ter controle ou só as bebidas?

### F. Usuários e permissões

- **F1.** Quem usa cada tela? Os garçons têm login individual ou compartilhado?
- **F2.** Em qual aparelho cada função usa o sistema (celular do garçom, tablet na cozinha, tablet na churrasqueira, computador no caixa)?
- **F3.** O dono quer ver relatórios e fazer cadastros de qualquer lugar (celular em casa)?
- **F4.** Quem tem autoridade para cancelar, dar desconto e alterar contas?
- **F5.** Queremos saber **quem** fez cada ação (garçom que lançou, caixa que recebeu)? Isso é aceitável para a equipe?

### G. Relatórios

- **G1.** Quais relatórios o dono quer ver primeiro? (vendas do dia, produtos mais vendidos, contas abertas, cancelamentos, pagamentos por forma, vendas por garçom)
- **G2.** Em que frequência (diário, semanal, mensal)?
- **G3.** Quer exportar para planilha ou imprimir?

### H. Fiscal e legal (confirmar com um contador)

- **H1.** O restaurante já usa algum sistema fiscal (PDV, emissor de NFC-e, SAT)? Qual?
- **H2.** O novo sistema vai conviver com o sistema fiscal existente (os dois registrando) ou o fiscal precisa ser integrado? O sistema atual apenas registra pedidos e pagamentos; **não emite nota fiscal**.
- **H3.** O registro de nomes de clientes (separação de contas) exige alguma cautela com a LGPD no caso do restaurante?
- **H4.** Por quanto tempo é preciso guardar os registros de vendas?

### I. Operação e rotina

- **I1.** O que fazer se a internet cair no meio do movimento? A proposta simples é voltar ao papel e registrar depois. O dono concorda?
- **I2.** Como está o Wi-Fi no salão e na churrasqueira? O sinal chega em todas as mesas?
- **I3.** Quem vai dar suporte durante o horário de funcionamento quando o sistema der problema?
- **I4.** Quanto tempo de **piloto em paralelo com o papel** o dono aceita antes de abandonar as anotações? (Sugestão: pelo menos 1 a 2 semanas.)
- **I5.** Qual é a data ideal para começar o piloto (evitar fim de semana forte e feriados)?
- **I6.** O dono aceita treinar a equipe? Qual é o melhor horário?
- **I7.** Há orçamento mensal para o sistema (hospedagem, plano pago do banco, domínio)?

### J. Infraestrutura (decisão minha, com apoio do assistente)

- **J1.** Qual plano do Supabase e da Vercel é adequado ao movimento do restaurante (quantas pessoas conectadas ao mesmo tempo, volume de pedidos por noite)? O plano gratuito pausa projetos inativos e tem limites; é preciso verificar nos sites oficiais antes de decidir.
- **J2.** Como configurar **dois ambientes** (teste e produção) e backups do banco?
- **J3.** Como guardar senhas e chaves com segurança (gerenciador de senhas)?

---

## 3. Formato de resposta (para colar de volta no Claude Code)

Para cada pergunta respondida pelo dono ou pela equipe, use este formato curto:

```
Código: A1
Resposta do restaurante: (o que a pessoa realmente disse)
Quem respondeu: (nome ou função)
Decisão para o sistema: (uma frase: como o sistema deve se comportar)
Ainda tenho dúvida: (sim/não, e qual)
```

Perguntas sem resposta devem ficar marcadas como "pendente". Para a lista de produtos (D1), use uma tabela:

```
Produto | Preço | Setor (churrasqueira/cozinha/nenhum) | Controle de estoque (sim/não)
```

---

## 4. Ordem de importância (o que preciso primeiro)

1. **D1** (lista de produtos), **A1 a A3**, **B1 a B4**, **C1 a C2**: bloqueiam o que falta do protótipo.
2. **F1 a F5** e **H1 a H2**: bloqueiam login e a parte fiscal.
3. **E1 a E5** e **G1**: bloqueiam estoque e relatórios.
4. **I1 a I7** e **J1 a J3**: necessárias antes de publicar e fazer o piloto.
