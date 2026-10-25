# Publicação com domínio próprio (Vercel + Hostinger)

Guia para colocar o sistema no ar. **Nada disso foi feito ainda**: publicar, contratar planos e mexer no domínio dependem de autorização do dono do projeto.

## Antes de publicar (checklist)
1. Cadastro livre desligado: Supabase → Authentication → Sign In / Providers → desmarcar "Allow new users to sign up".
2. Trava do login ligada e as contas da equipe testadas (ver `docs/DECISOES.md`, "Login e permissões").
3. Senha do banco trocada (ela já apareceu numa conversa): Supabase → Project Settings → Database.
4. Dono com senha forte, guardada num gerenciador de senhas. Contas reservas criadas no painel do Supabase e o perfil definido em `/equipe`.
5. `npm test` e `npm run build` passando.

## Passo a passo
1. **Vercel**: criar conta, importar o repositório do GitHub (`Jarrao--espetaria`). Framework: Next.js (detecção automática).
2. **Variáveis de ambiente** na Vercel (Settings → Environment Variables): `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (as mesmas do `.env.local`). A chave `anon` é pública por desenho; a segurança está nas regras do banco. **Nunca** colocar a chave `service_role`.
3. **Deploy** e conferir o endereço `*.vercel.app`.
4. **Domínio**: recomendo um subdomínio (ex.: `app.seudominio.com.br`), assim o site principal da Hostinger não é afetado. Na Vercel: Settings → Domains → adicionar. A Vercel mostra o registro DNS exato (normalmente um `CNAME`); copie **os valores da tela da Vercel**, não de outro lugar. Na Hostinger: Domínios → DNS / Zona DNS → adicionar o registro. Propagação: minutos a algumas horas. O HTTPS é emitido automaticamente.
5. **Supabase → Authentication → URL Configuration**: colocar o novo endereço em "Site URL".
6. Entrar com cada perfil e testar o fluxo completo.

## Custos (conferidos em 25/10/2026; confirme nas páginas oficiais antes de contratar)
| | Demonstração | Uso real no restaurante |
|---|---|---|
| Vercel | Hobby (grátis, **só uso pessoal/não comercial**) | Pro: US$ 20/mês |
| Supabase | Free (pausa após 7 dias sem uso, **sem backup diário**) | Pro: a partir de US$ 25/mês (backup de 7 dias) |
| Total | R$ 0 | ≈ US$ 45/mês (acima do orçamento de R$ 100–200 informado) |

Domínio já pago na Hostinger. **Recomendação:** usar Hobby + Free **só para mostrar ao dono, com dados fictícios**. Para operar de verdade, decidir o orçamento antes: no plano Free o banco pode pausar e não há backup, o que é arriscado para dados de caixa.

## Riscos e melhorias futuras
- Supabase Free pausado: o sistema fica fora do ar até alguém reativar no painel.
- Backups: no Free, fazer exportação manual periódica; no Pro, há backups diários.
- CSP com `nonce` (mais rígida) exige páginas dinâmicas; avaliar depois.
- Recuperação de senha por e-mail não existe: o dono redefine pelo painel do Supabase.
