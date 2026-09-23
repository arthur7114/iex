-- 0119_email_modelo_assinatura.sql
-- E-mail da proposta personalizável.
--  * config_empresa: modelo padrão (assunto + corpo) com variáveis {{...}},
--    renderizado por lib/email/modelo.ts. Nulo => texto padrão do código.
--  * usuarios: assinatura de e-mail de quem envia, em modo 'html' (montada a
--    partir dos campos) ou 'imagem' (PNG/JPG no bucket branding). Nulo => 'html'.
--  Migração ADITIVA e idempotente (segue o estilo de 0110/0118). Sem backfill.
begin;

alter table public.config_empresa
  add column if not exists email_assunto_modelo text,
  add column if not exists email_corpo_modelo text;

alter table public.usuarios
  add column if not exists assinatura_modo text,
  add column if not exists assinatura_telefone text,
  add column if not exists assinatura_email text,
  add column if not exists assinatura_foto_path text,
  add column if not exists assinatura_imagem_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usuarios_assinatura_modo_check'
  ) then
    alter table public.usuarios
      add constraint usuarios_assinatura_modo_check
      check (assinatura_modo is null or assinatura_modo in ('html', 'imagem'));
  end if;
end $$;

insert into public._iex_migrations (name, applied_at)
select '0119_email_modelo_assinatura.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0119_email_modelo_assinatura.sql');

commit;
