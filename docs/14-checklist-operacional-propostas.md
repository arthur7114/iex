# Checklist operacional — propostas IEX

As tarefas abaixo dependem de agenda, credenciais, DNS ou aceite humano e não são executadas automaticamente pela aplicação.

## Banco e implantação

- [x] Conceder acesso do Supabase CLI ao projeto `qkobmpdawjcbgumxzpzh` ou fornecer `SUPABASE_PROJECT_REF` e `SUPABASE_DB_PASSWORD`.
- [x] Conferir `public._iex_migrations`.
- [x] Aplicar idempotentemente `0110`, `0112`, `0113` e `0114` (não existe arquivo `0111` no repositório).
- [x] Aplicar `0115_padronizacao_propostas.sql`.
- [ ] Executar o teste concorrente de numeração e snapshot descrito em `docs/13-qa-roteiro-onda3.md`.

## Resend — domínio `iexprojetos.com`

- [ ] Yves agenda reunião com João Paulo.
- [ ] Adicionar o domínio no Resend.
- [ ] Publicar e validar os registros SPF e DKIM informados pelo Resend.
- [ ] Configurar `RESEND_API_KEY`.
- [ ] Configurar `EMAIL_FROM=IEX Propostas <propostas@iexprojetos.com>`.
- [ ] Fazer um envio real e conferir remetente, assunto com `Vn`, anexo versionado e auditoria.

## Banco

- [ ] Aplicar a migration `0118_perfil_cargo.sql` **antes** de publicar esta versão.
      O código lê `usuarios.cargo` em `getUsuarioAtual`, na Equipe e na assinatura
      das propostas; sem a coluna, essas consultas falham e o perfil do usuário cai
      no fallback de sessão.

## Supabase Auth

Convites, reenvios e redefinições de senha são gerados por `generateLink` e entregues pelo
Resend, com o link já no formato que `/auth/callback` valida (`token_hash` + `type`). Não
dependem mais do SMTP nem dos templates de e-mail do Supabase.

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
