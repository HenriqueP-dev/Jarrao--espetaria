# JARRÃO ESPETARIA — CONTEXTO COMPLETO DO PROJETO

## 1. Objetivo deste documento

Este documento reúne todas as informações levantadas até agora sobre o sistema que queremos desenvolver para o Jarrão Espetaria.

Ele deve servir como contexto inicial para o Claude Code, orientando o planejamento, a arquitetura e o desenvolvimento do projeto.

Importante: este documento não significa que todas as funcionalidades e decisões já estão aprovadas. É necessário distinguir:

* Fatos sobre o funcionamento atual do restaurante.
* Objetivos do sistema.
* Ideias e hipóteses que ainda precisam ser validadas.
* Decisões técnicas ainda não tomadas.

Não invente regras de negócio que não estejam descritas aqui. Quando uma informação importante estiver faltando, registre a dúvida e proponha uma solução simples.

## 2. Sobre o projeto

O projeto consiste em desenvolver um sistema web para integrar a operação do Jarrão Espetaria, localizado em Barretos, São Paulo.

A ideia é centralizar as informações sobre:

* Pedidos.
* Mesas e comandas.
* Cozinha.
* Churrasqueira.
* Entrega dos pedidos.
* Caixa e pagamentos.
* Estoque.
* Histórico e relatórios.

O sistema deve funcionar em vários dispositivos simultaneamente. Os garçons poderão registrar pedidos pelos próprios celulares ou por aparelhos disponíveis para eles. Os setores responsáveis pelo preparo terão telas para visualizar os pedidos recebidos.

A prioridade é construir algo útil para a operação real, simples de utilizar e rápido de desenvolver.

## 3. Objetivo principal

Queremos que o sistema seja a memória central da operação do restaurante.

Ele deve registrar o que foi pedido, acompanhar o andamento dos pedidos, manter o consumo associado às mesas e permitir que o caixa consulte os itens registrados e os pagamentos.

A visão é que as informações circulem pelo sistema sem depender de anotações em papel ou de alguém precisar redigitar os mesmos dados.

Queremos conseguir responder a perguntas como:

* O que cada mesa pediu?
* Quais itens estão aguardando preparo?
* Quais estão sendo preparados?
* Quais ficaram prontos?
* Quais foram entregues?
* O que está registrado na conta de cada mesa?
* Quais contas estão abertas ou fechadas?
* Quais itens foram cancelados?
* Quais pagamentos foram registrados?
* Quanto foi vendido de cada produto?
* Como está o estoque registrado?

O sistema deve manter o histórico dos acontecimentos para facilitar a conferência e a investigação de divergências.

## 4. Como o restaurante funciona atualmente

### 4.1 Equipe

A composição habitual é:

* Cozinha: aproximadamente quatro pessoas.
* Caixa: uma pessoa.
* Churrasqueira: o proprietário e mais um funcionário.
* Garçons: normalmente três ou quatro.

Não existem setores fixos de atendimento para cada garçom. A equipe trabalha de maneira colaborativa, e quem estiver disponível pode atender quem chamar.

Durante os períodos de maior movimento, os funcionários precisam agir rapidamente. A interface não deve exigir muitos preenchimentos ou etapas desnecessárias.

### 4.2 Mesas

O restaurante possui mesas numeradas de 1 a 8 e de 10 a 23. Não existe mesa número 9.

São 22 mesas numeradas nesse conjunto.

As mesas físicas podem mudar de posição no estabelecimento. Portanto, o sistema deve identificar as mesas por seu número lógico, independentemente de onde estiverem fisicamente.

### 4.3 Processo atual de registro dos pedidos

Atualmente, o garçom anota os pedidos em uma caderneta e em papéis utilizados para encaminhar os itens aos setores.

Os papéis são colocados em locais visíveis:

* Na churrasqueira, sob um suporte metálico com ímã.
* Na cozinha, na geladeira, também utilizando ímãs.

O sistema digital deverá substituir a necessidade de encaminhar essas anotações para os pedidos que forem registrados nele.

### 4.4 Destino dos itens

Os itens são encaminhados de acordo com o setor responsável.

Churrasqueira:

* Espetos.
* Jantinhas, inicialmente encaminhadas à churrasqueira.

Cozinha:

* Batata frita.
* Quibes.
* Saladas.
* Caipirinhas.
* Outros itens que forem definidos como responsabilidade da cozinha.

O destino dos produtos deve poder ser configurado conforme o cadastro e as regras do restaurante, em vez de depender de lógica espalhada pelo código.

### 4.5 Regra especial da jantinha

A jantinha tem um fluxo particular.

1. O garçom registra a jantinha.
2. O pedido aparece para a churrasqueira.
3. A churrasqueira prepara o espeto e solicita verbalmente à cozinha a montagem do prato.
4. A cozinha prepara o prato e comunica verbalmente quando termina.
5. A churrasqueira coordena a retirada e a entrega conforme o processo atual.

Não precisamos informatizar todas as conversas internas.

Para o sistema, a jantinha é encaminhada à churrasqueira. A comunicação verbal entre churrasqueira e cozinha pode continuar como já acontece hoje.

Não crie um fluxo digital adicional para a cozinha receber uma segunda ordem de jantinha, a menos que isso seja discutido e aprovado futuramente.

### 4.6 Preparação e entrega

Atualmente, a equipe organiza a preparação utilizando os papéis recebidos. Os pedidos geralmente são preparados por ordem de chegada, mas itens simples podem ficar prontos antes de outros.

Quando um item fica pronto, a equipe sinaliza com uma campainha ou verbalmente. O garçom precisa identificar o pedido e retirar os itens.

O sistema deve melhorar a visibilidade do andamento e reduzir a necessidade de perguntar aos setores o estado dos pedidos.

Ainda precisamos decidir exatamente como os estados serão representados e se cada item ou cada grupo de itens será atualizado individualmente.

### 4.7 Comandas e fechamento das contas

Quando os itens são servidos, as comandas físicas ficam reservadas por mesa.

Para fechar uma conta:

1. O garçom reúne as comandas daquela mesa.
2. Confere se ainda existem itens sendo preparados.
3. Leva a conta ao caixa.
4. O caixa calcula e confere o total.
5. O pagamento é realizado, normalmente com uma maquininha.
6. Os papéis são devolvidos ao caixa para controle.

Algumas contas grandes são fechadas pelos garçons diretamente na mesa.

O sistema deve permitir consultar o consumo registrado de uma mesa e calcular os valores com base nos produtos e preços cadastrados.

### 4.8 Formas de pagamento

As formas de pagamento já identificadas são:

* Dinheiro.
* Cartão de débito.
* Cartão de crédito.

A aceitação e o processo de registro de Pix ainda precisam ser confirmados.

Não é necessário integrar diretamente com a maquininha de pagamento na primeira versão. Podemos registrar manualmente a forma de pagamento e o valor informado, desde que isso fique claramente definido como registro do pagamento, e não como confirmação automática feita pela operadora.

### 4.9 Separação de contas

Quando os clientes desejam separar a conta, o processo atual utiliza os nomes das pessoas associados aos itens da comanda.

Queremos preservar essa possibilidade sem obrigar o garçom a identificar individualmente cada pessoa quando a conta não for separada.

Uma ideia proposta é utilizar um campo para a identificação da mesa e, opcionalmente, da pessoa.

Exemplos:

* `12`: consumo da mesa 12 sem identificação individual.
* `12 / João`: itens atribuídos à parte de João na mesa 12.
* `12 / Maria`: itens atribuídos à parte de Maria na mesa 12.

Essas identificações devem continuar relacionadas à mesma mesa e à conta correspondente.

A interface deve permitir registrar itens rapidamente. Não queremos obrigar os garçons a preencher o nome de cada consumidor ou associar individualmente todos os itens quando isso não for necessário.

Ainda precisamos definir como funcionará a divisão de valores, o tratamento de itens compartilhados e a possibilidade de mover itens entre partes da conta.

### 4.10 Problemas atuais de cobrança

O restaurante enfrenta situações em que itens consumidos não são registrados corretamente na comanda ou acabam não sendo cobrados.

Também ocorrem divergências ocasionais nos valores das contas.

Durante os horários de maior movimento, é difícil investigar imediatamente uma divergência usando apenas os papéis.

O sistema deve manter um registro claro dos itens adicionados, das alterações e dos cancelamentos, permitindo consultar o histórico de uma conta.

O sistema pode ajudar a diminuir esquecimentos, mas não deve presumir que um item foi registrado apenas porque foi preparado ou entregue. A operação precisa utilizar o fluxo de registro corretamente.

### 4.11 Cancelamentos, alterações e itens indisponíveis

Atualmente:

* Quando um item é cancelado, o garçom risca o papel e comunica o setor responsável.
* Quando um item acaba, o setor comunica aos garçons.
* O garçom informa o cliente e pergunta se deseja substituir o item ou acrescentar outra coisa.
* Quando um item é preparado incorretamente ou há reclamação, a equipe comunica o setor e providencia a correção ou substituição.

O sistema deve contemplar cancelamentos e alterações, mas as regras exatas de autorização e os efeitos sobre o estoque ainda precisam ser definidos.

Não apague silenciosamente registros importantes. O histórico deve permitir compreender o que ocorreu.

### 4.12 Controle financeiro e relatórios

Atualmente, o caixa utiliza comprovantes e anotações para acompanhar os valores recebidos. Parte da conferência pode ocorrer posteriormente.

O restaurante não possui controle confiável e detalhado de vendas por produto.

O sistema deverá permitir que os dados registrados sejam utilizados em relatórios, por exemplo:

* Quantidade vendida por produto.
* Valor de vendas por período.
* Itens mais vendidos.
* Contas abertas e fechadas.
* Pagamentos registrados.
* Cancelamentos e ajustes.

Os relatórios devem refletir os dados efetivamente registrados. Não apresentar estimativas como se fossem valores financeiros confirmados.

### 4.13 Estoque

O controle atual do estoque de bebidas é impreciso. A equipe trabalha com fardos e estimativas, sem uma contagem confiável de todas as saídas.

A ideia é cadastrar os produtos controlados, registrar entradas e acompanhar as saídas relacionadas às vendas.

Precisamos considerar que o estoque também pode mudar por motivos diferentes de uma venda, como:

* Reposição e recebimento de mercadorias.
* Perdas.
* Consumo interno.
* Ajustes de inventário.

Ainda será necessário decidir quais produtos serão controlados na primeira versão, como as unidades serão representadas e como as movimentações serão registradas.

Não presumir que o estoque será confiável apenas por descontar automaticamente os itens vendidos.

## 5. Como queremos que o sistema funcione

### 5.1 Registro do pedido pelo garçom

O garçom chega à mesa, escuta o pedido e registra os itens no aparelho.

Queremos que o preenchimento seja rápido, com o mínimo necessário de informações.

A ideia inicial é que o garçom informe:

1. A mesa e, opcionalmente, a identificação da pessoa ou parte da conta.
2. Os itens e suas quantidades.

O sistema deve obter os preços e os destinos dos produtos a partir do cadastro, sem exigir que o garçom informe manualmente essas informações a cada pedido.

O garçom deve conseguir adicionar vários itens no mesmo registro.

### 5.2 Envio instantâneo aos setores

Assim que o pedido for registrado e confirmado, os itens devem aparecer instantaneamente nas telas dos setores responsáveis.

Exemplo: a mesa 12 pede dois espetos de carne e uma batata frita.

* Os dois espetos aparecem na churrasqueira.
* A batata frita aparece na cozinha.
* Os itens continuam associados ao mesmo pedido e à conta da mesa 12.

A cozinha não deve receber os espetos, e a churrasqueira não deve receber a batata frita.

O sistema deve distribuir os itens automaticamente de acordo com seus destinos cadastrados.

Não queremos que o garçom precise registrar o mesmo pedido em várias telas.

### 5.3 Acompanhamento do pedido

O sistema deverá permitir acompanhar o andamento dos itens.

Estados candidatos:

* Novo pedido.
* Em preparação.
* Pronto.
* Entregue.
* Cancelado.

Essa é uma proposta inicial, não uma lista definitiva. Os estados finais deverão ser simples e corresponder ao funcionamento real.

Precisamos definir se o estado será controlado por item ou por grupo de itens. O importante é permitir acompanhar o que está acontecendo sem criar burocracia para os funcionários.

Se dois espetos ficarem prontos antes da batata, o sistema deve ser capaz de representar essa situação de maneira adequada, caso decidamos pelo acompanhamento individual.

### 5.4 Relação entre pedido, mesa e conta

O pedido deve manter sua relação com:

* A mesa.
* A conta correspondente.
* Os itens registrados.
* As quantidades e os preços aplicáveis.
* O setor responsável por cada item.
* O histórico do andamento.
* Eventuais alterações e cancelamentos.
* Os registros de pagamento da conta.

Mesmo quando os itens são distribuídos para setores diferentes, eles devem permanecer relacionados ao pedido original e à conta correta.

### 5.5 Histórico

O sistema deve guardar informações suficientes para entender o que aconteceu.

Eventos importantes incluem:

* Pedido registrado.
* Item encaminhado ao setor.
* Início da preparação, caso esse estado seja adotado.
* Item marcado como pronto.
* Item marcado como entregue.
* Item alterado ou cancelado.
* Conta fechada.
* Pagamento registrado.
* Ajustes relevantes no estoque.

Não precisamos implementar um sistema de auditoria excessivamente complexo no protótipo. Precisamos de um histórico útil, consistente e proporcional à necessidade.

## 6. Principais módulos previstos

### Módulo A — Garçom e pedidos

* Selecionar mesa.
* Identificar opcionalmente uma pessoa ou parte da conta.
* Adicionar produtos e quantidades.
* Registrar o pedido.
* Consultar pedidos e seu andamento.
* Consultar os itens associados à mesa.

### Módulo B — Cozinha

* Visualizar os itens encaminhados à cozinha.
* Identificar a mesa e a conta.
* Consultar os itens pendentes.
* Atualizar o andamento dos itens.

### Módulo C — Churrasqueira

* Visualizar os itens encaminhados à churrasqueira.
* Identificar a mesa e a conta.
* Visualizar espetos e jantinhas.
* Atualizar o andamento dos itens.

### Módulo D — Mesas e comandas

* Visualizar as mesas.
* Identificar contas abertas.
* Consultar consumo acumulado.
* Consultar itens pendentes.
* Separar contas quando solicitado.
* Fechar contas de acordo com as regras definidas.

### Módulo E — Caixa

* Consultar os itens registrados.
* Conferir o valor da conta.
* Registrar pagamentos e suas formas.
* Identificar contas abertas e encerradas.
* Consultar o histórico de alterações relevantes.

### Módulo F — Produtos e preços

* Cadastrar produtos.
* Definir preços.
* Definir o setor responsável pela preparação.
* Definir se o produto terá controle de estoque.
* Permitir atualizar os dados sem alterar indevidamente registros antigos.

### Módulo G — Estoque

* Registrar estoque inicial.
* Registrar recebimentos.
* Registrar perdas e ajustes.
* Consultar quantidades registradas.
* Relacionar as vendas às movimentações de estoque, conforme as regras aprovadas.

### Módulo H — Relatórios

* Consultar vendas por período.
* Consultar quantidades vendidas por produto.
* Consultar contas e pagamentos registrados.
* Consultar cancelamentos e movimentações relevantes.

Esses módulos representam a visão desejada do sistema. Não é obrigatório implementar todos antes de testar o primeiro fluxo completo.

## 7. Princípios de desenvolvimento

Quero desenvolver este projeto para aprender programação e construir um portfólio. Não quero apenas receber um sistema pronto sem compreender como ele funciona.

O desenvolvimento deve seguir estes princípios:

1. Priorizar funcionalidades úteis para o restaurante.
2. Manter a interface simples e rápida.
3. Evitar abstrações, módulos e tecnologias desnecessariamente complexos.
4. Não criar funcionalidades apenas porque parecem interessantes.
5. Não transformar toda comunicação verbal em um fluxo digital.
6. Não adicionar campos obrigatórios que não tenham uma finalidade clara.
7. Não começar a implementar módulos grandes antes de validar o fluxo principal.
8. Manter o código organizado e explicar as principais decisões.
9. Escrever testes para as regras importantes.
10. Manter a documentação atualizada quando uma regra mudar.
11. Separar fatos conhecidos de hipóteses e decisões pendentes.
12. Evitar que várias IAs façam mudanças conflitantes nos mesmos arquivos.

Quero que o Claude Code ajude a implementar, testar e explicar o sistema, mas que eu também consiga entender o código e participar das decisões.

## 8. Escopo inicial do protótipo

O objetivo inicial é produzir um protótipo funcional para testes, não colocar imediatamente o sistema em operação real.

A primeira entrega deverá demonstrar o fluxo principal:

1. O garçom registra um pedido.
2. O sistema associa o pedido à mesa e à conta.
3. Os itens são encaminhados aos setores corretos.
4. Os setores visualizam os pedidos.
5. O andamento dos itens pode ser atualizado.
6. A entrega pode ser registrada.
7. Os itens ficam associados à conta.
8. O caixa consulta o consumo e registra um pagamento de teste.
9. O sistema mantém o histórico relevante.

Depois que esse fluxo funcionar, poderemos ampliar o protótipo para separação de contas, estoque e relatórios.

Devemos utilizar dados fictícios durante os testes iniciais. A decisão de adotar o sistema na operação real será tomada posteriormente, após avaliar sua utilidade e confiabilidade.

## 9. Tecnologias e ambiente

O proprietário do projeto está aprendendo desenvolvimento e utiliza:

* Windows.
* VS Code.
* Git e GitHub.
* Vercel.
* HTML, CSS e JavaScript.
* Java e Python em atividades de aprendizagem.

Python e Portugol são atualmente as linguagens com as quais tem maior familiaridade, mas isso não significa que o sistema precise ser desenvolvido em Python.

A tecnologia da aplicação ainda não foi escolhida.

O sistema precisará funcionar em diferentes dispositivos, compartilhar dados entre usuários e atualizar as telas dos setores em tempo real.

Recomende uma arquitetura simples, adequada a esses requisitos e viável para um desenvolvedor iniciante. Explique os motivos da recomendação antes de implementar.

Não escolha uma tecnologia apenas por popularidade. Considere a velocidade para construir o protótipo, a facilidade de aprendizado, o custo, a manutenção e o suporte a atualizações em tempo real.

## 10. Decisões ainda pendentes

Não considere as seguintes questões definitivamente resolvidas:

* Arquitetura e tecnologias.
* Banco de dados e hospedagem.
* Modelo de autenticação e permissões.
* Estados definitivos dos pedidos.
* Atualização individual dos itens ou por grupos.
* Regras completas de abertura e encerramento de contas.
* Divisão de contas e itens compartilhados.
* Regras de autorização para alterações e cancelamentos.
* Tratamento de pagamentos parciais e múltiplas formas de pagamento.
* Produtos que terão controle de estoque no protótipo.
* Regras para perdas, consumo interno e ajustes.
* Relatórios que entrarão na primeira versão.
* Política de contingência em caso de indisponibilidade.
* Critérios de aceitação de cada funcionalidade.

Não precisamos resolver todas essas questões de uma vez. Identifique quais são necessárias para implementar o primeiro fluxo e deixe as demais para quando o módulo correspondente for desenvolvido.

## 11. Instruções para o Claude Code

Esta pasta foi recém-criada e ainda não contém contexto ou código do projeto.

Comece lendo este documento como referência inicial.

Sua primeira tarefa é:

1. Verificar o estado da pasta e identificar se já existe algum arquivo ou configuração.
2. Recomendar uma arquitetura simples para o protótipo.
3. Propor a menor sequência de etapas capaz de entregar o fluxo principal funcionando.
4. Identificar apenas as decisões que realmente impedem o início da implementação.
5. Sugerir uma estrutura inicial de arquivos e documentação.
6. Explicar as escolhas técnicas em linguagem acessível para alguém que está aprendendo programação.

Evite fazer uma longa lista de riscos hipotéticos antes de termos uma versão funcional. Considere os requisitos de consistência e funcionamento, mas mantenha a discussão proporcional ao estágio do projeto.

Não comece criando todos os módulos de uma vez. Priorize um fluxo vertical completo: registro do pedido, distribuição para o setor, atualização do andamento, entrega e associação à conta.

Depois de apresentar o plano e esclarecer as decisões essenciais, implemente por etapas pequenas e verificáveis. Não altere regras de negócio silenciosamente.

O objetivo é chegar a um protótipo funcional o mais rápido possível, com uma base organizada e sem complexidade desnecessária.
