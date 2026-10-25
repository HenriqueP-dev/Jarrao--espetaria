-- 016: índices para as consultas que as telas fazem o tempo todo (auditoria, etapa 9).
-- Hoje o banco é pequeno e não se nota diferença; com meses de uso, sem índice, cada
-- consulta leria a tabela inteira. Índice não muda nenhum dado nem regra.

-- chaves estrangeiras apontadas pelo relatório do Supabase
create index if not exists itens_pedido_conta_idx on itens_pedido (conta_id);
create index if not exists itens_pedido_pedido_idx on itens_pedido (pedido_id);
create index if not exists itens_pedido_produto_idx on itens_pedido (produto_id);
create index if not exists historico_conta_idx on historico (conta_id, criado_em);
create index if not exists historico_item_idx on historico (item_id);
create index if not exists pagamentos_conta_idx on pagamentos (conta_id);
create index if not exists pedidos_conta_idx on pedidos (conta_id);

-- telas da cozinha e da churrasqueira: itens do setor que ainda estão na fila
create index if not exists itens_pedido_fila_idx on itens_pedido (setor, criado_em)
  where estado in ('novo', 'em_preparo', 'pronto') or (estado = 'cancelado' and cancelamento_visto_em is null);

-- relatório de vendas: eventos de fechamento e de cancelamento
create index if not exists historico_evento_idx on historico (evento, criado_em);
