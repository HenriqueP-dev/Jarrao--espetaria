-- Dados FICTÍCIOS para teste. Rode depois da migration.

insert into mesas (numero)
select n from generate_series(1, 23) n where n <> 9;

insert into produtos (nome, preco_centavos, setor) values
  ('Espeto de carne', 1200, 'churrasqueira'),
  ('Espeto de frango', 1000, 'churrasqueira'),
  ('Espeto de linguiça', 1100, 'churrasqueira'),
  ('Jantinha', 3500, 'churrasqueira'),
  ('Batata frita', 2800, 'cozinha'),
  ('Quibe', 600, 'cozinha'),
  ('Salada', 1800, 'cozinha'),
  ('Caipirinha', 1800, 'cozinha');
