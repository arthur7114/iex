-- 0110_documento_branding.sql
-- Branding dos documentos gerados (PDF/Word) — PRD 008 / Frente A.
-- Garante, de forma idempotente, as colunas de identidade visual da empresa
-- consumidas por lib/document/montar.ts (logo, assinatura e cores de marca).
begin;

alter table public.config_empresa
  add column if not exists logo_path text,
  add column if not exists assinatura_path text,
  add column if not exists cor_primaria text,
  add column if not exists cor_secundaria text;

insert into public._iex_migrations (name, applied_at)
select '0110_documento_branding.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0110_documento_branding.sql');

commit;
