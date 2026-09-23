# Checklist operacional — propostas IEX

As tarefas abaixo dependem de agenda, credenciais, DNS ou aceite humano e não são executadas automaticamente pela aplicação.

## Banco e implantação

- [x] Conceder acesso do Supabase CLI ao projeto `qkobmpdawjcbgumxzpzh` ou fornecer `SUPABASE_PROJECT_REF` e `SUPABASE_DB_PASSWORD`.
- [x] Conferir `public._iex_migrations`.
- [x] Aplicar idempotentemente `0110`, `0112`, `0113` e `0114` (não existe arquivo `0111` no repositório).
- [x] Aplicar `0115_padronizacao_propostas.sql`.
- [ ] Executar o teste concorrente de numeração e snapshot descrito em `docs/13-qa-roteiro-onda3.md`.
- [x] Aplicar `0119_email_modelo_assinatura.sql` e rodar `node scripts/validate-migration-0119.mjs`.

## E-mail — SMTP Titan (`iexprojetos.com`)

O envio sai pela caixa da IEX no Titan (`smtp.titan.email`, porta 465, SSL/TLS).

- [x] Configurar `SMTP_USER` (e-mail completo da caixa) e `SMTP_PASS` (senha da caixa) — local e no Easypanel (depois de salvar, refazer o deploy para carregar as variáveis).
- [x] Manter `SMTP_HOST=smtp.titan.email` e `SMTP_PORT=465` (já são o padrão).
- [x] Configurar `EMAIL_FROM=IEX Propostas <propostas@iexprojetos.com>` com o **mesmo endereço** de `SMTP_USER`.
- [ ] Fazer um envio real e conferir remetente, assunto com `Vn`, anexo versionado e auditoria.
- [ ] Configurar o modelo em Configurações › E-mail e a assinatura de cada vendedor em Meu perfil.
- [ ] Envio real: conferir assinatura com imagens no Gmail e no Outlook, e que "Responder" vai para quem enviou.

## Banco

- [ ] Aplicar a migration `0118_perfil_cargo.sql` **antes** de publicar esta versão.
      O código lê `usuarios.cargo` em `getUsuarioAtual`, na Equipe e na assinatura
      das propostas; sem a coluna, essas consultas falham e o perfil do usuário cai
      no fallback de sessão.

## Supabase Auth

Convites, reenvios e redefinições de senha são gerados por `generateLink` e entregues pelo
SMTP da IEX, com o link já no formato que `/auth/callback` valida (`token_hash` + `type`). Não
dependem do SMTP nem dos templates de e-mail do Supabase.

- [ ] Configurar a URL pública da aplicação e as URLs de redirecionamento permitidas.
- [ ] Configurar `NEXT_PUBLIC_SITE_URL` com a URL pública.
- [ ] Testar convite, reenvio, `/auth/callback`, `/definir-senha` e redefinição de senha
      (pelo painel de Equipe e pelo "Esqueci minha senha" da tela de login).
- [ ] Confirmar Alderi como acesso resolvido, sem novo convite.

## Assinatura das propostas

- [ ] Preencher o cargo dos membros em **Configurações → Equipe** (em branco imprime
      "Diretor Comercial", o padrão do documento).
- [ ] Gerar uma proposta assinada por outra pessoa (revisão final → **Editar assinatura**)
      e conferir no PDF, no Word e na prévia que o nome e o cargo saem corretos.
- [ ] Conferir que o responsável pela proposta continua sendo quem a redigiu, no
      histórico e no filtro da lista.

## Adoção e precificação

- [ ] Equipe assiste aos vídeos explicativos enviados.
- [ ] Equipe gera propostas de teste com área, mínimo, serviço fixo e complexidade ligada/desligada.
- [ ] Equipe revisa totais e parcelas 40/40/20.
- [ ] Equipe aprova ou ajusta os valores do catálogo.
- [ ] Registrar responsável, data e observações do aceite comercial.
