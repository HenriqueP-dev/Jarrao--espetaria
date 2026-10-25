# Cópia de segurança e restauração

Há três camadas. As duas primeiras já funcionam; a terceira depende do plano pago.

## 1. Cópia pelo navegador (o dono faz, sem programa nenhum)
1. Entre como dono e abra **Equipe → Cópia de segurança → Baixar cópia de segurança**.
2. Sai um arquivo `jarrao-copia-AAAA-MM-DD-HHMM.json` com pedidos, contas, pagamentos (inclusive os estornados), estoque, cardápio e todo o histórico.
3. Guarde **fora do aparelho** (e-mail para você mesmo, Google Drive, pendrive). Sugestão: toda segunda-feira, e antes de qualquer mudança grande.

O arquivo **não** tem senhas nem as contas de login (essas ficam no Supabase Auth).

## 2. Restaurar uma cópia
Use quando o banco for perdido ou para montar um banco novo com os dados antigos.

1. Banco novo no Supabase com as migrations aplicadas (lista no `README.md`).
2. No computador, na pasta do projeto:
   ```
   node scripts/gerar-restauracao.mjs caminho/da/jarrao-copia-AAAA-MM-DD-HHMM.json
   ```
   Isso cria `...-restaurar.sql` ao lado da cópia (o aviso "MODULE_TYPELESS_PACKAGE_JSON" pode ser ignorado).
3. Abra o `.sql`, copie tudo e rode no **SQL Editor** do Supabase. É tudo ou nada: se der erro, nada muda.
4. Recrie as contas de login (Authentication → Users) e dê os perfis de novo em `/equipe` (o primeiro dono por SQL, como no `README.md`).

Detalhes: os dados entram com os mesmos números (id) de antes; os gatilhos ficam desligados só durante a restauração, para não lançar de novo baixa de estoque nem autor de histórico; rodar duas vezes não duplica nada.

**Testado em 25/10/2026** com uma amostra real de todas as tabelas, num esquema temporário dentro de uma transação desfeita: todas as linhas voltaram iguais, os ids foram mantidos, o próximo id continua depois do maior e repetir não duplicou. Ainda **não** foi feita uma restauração completa num projeto Supabase separado: faça isso uma vez antes do uso real.

## 3. Backup automático do Supabase (plano Pro)
O plano gratuito não tem backup diário. O Pro (a partir de US$ 25/mês, ver `docs/PUBLICACAO.md`) guarda 7 dias de backups e restaura pelo painel. Para uso real no restaurante, é o recomendado, junto com a cópia semanal do item 1.

## Cópia completa por linha de comando (opcional, para quem programa)
Com a [CLI do Supabase](https://supabase.com/docs/guides/cli) e a senha do banco (nunca colocar a senha no código nem mandar em conversa):
```
supabase db dump --db-url "postgresql://postgres:[SENHA]@db.[PROJETO].supabase.co:5432/postgres" -f esquema.sql
supabase db dump --db-url "..." --data-only -f dados.sql
```
