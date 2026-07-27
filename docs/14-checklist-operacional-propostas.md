# Checklist operacional — propostas IEX

As tarefas abaixo dependem de agenda, credenciais, DNS ou aceite humano e não são executadas automaticamente pela aplicação.

## Banco e implantação

- [ ] Conceder acesso do Supabase CLI ao projeto `qkobmpdawjcbgumxzpzh` ou fornecer `SUPABASE_PROJECT_REF` e `SUPABASE_DB_PASSWORD`.
- [ ] Conferir `public._iex_migrations`.
- [ ] Aplicar idempotentemente `0110`, `0112`, `0113` e `0114` (não existe arquivo `0111` no repositório).
- [ ] Aplicar `0115_padronizacao_propostas.sql`.
- [ ] Executar o teste concorrente de numeração e snapshot descrito em `docs/13-qa-roteiro-onda3.md`.

## Resend — domínio `iexprojetos.com`

- [ ] Yves agenda reunião com João Paulo.
- [ ] Adicionar o domínio no Resend.
- [ ] Publicar e validar os registros SPF e DKIM informados pelo Resend.
- [ ] Configurar `RESEND_API_KEY`.
- [ ] Configurar `EMAIL_FROM=IEX Propostas <propostas@iexprojetos.com>`.
- [ ] Fazer um envio real e conferir remetente, assunto com `Vn`, anexo versionado e auditoria.

## Supabase Auth / SMTP

- [ ] Configurar o SMTP corporativo no painel do Supabase.
- [ ] Configurar a URL pública da aplicação e as URLs de redirecionamento permitidas.
- [ ] Configurar `NEXT_PUBLIC_SITE_URL` com a URL pública.
- [ ] No template **Invite user**, usar `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite`.
- [ ] No template **Reset password**, usar `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`.
- [ ] Confirmar que ambos os templates recebem `redirectTo=/auth/callback?next=/definir-senha`; o callback aceita também o fluxo PKCE por `code`.
- [ ] Testar convite, reenvio, `/auth/callback`, `/definir-senha` e redefinição de senha.
- [ ] Confirmar Alderi como acesso resolvido, sem novo convite.

## Adoção e precificação

- [ ] Equipe assiste aos vídeos explicativos enviados.
- [ ] Equipe gera propostas de teste com área, mínimo, serviço fixo e complexidade ligada/desligada.
- [ ] Equipe revisa totais e parcelas 40/40/20.
- [ ] Equipe aprova ou ajusta os valores do catálogo.
- [ ] Registrar responsável, data e observações do aceite comercial.
