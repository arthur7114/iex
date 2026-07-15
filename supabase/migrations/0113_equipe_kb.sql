-- 0113_equipe_kb.sql
-- Frente D — Equipe e Base de Conhecimento.
--  * Equipe: flag `ativo` como fonte de verdade para bloquear acesso (aplicada
--    também no auth via ban e no middleware). Migração idempotente.
--  * A situação do convite (pendente/aceito) e o último acesso são derivados de
--    auth.users (invited_at / confirmed_at / last_sign_in_at) via service-role —
--    não exigem colunas próprias.
--  * Base de conhecimento: metadados do arquivo (mime, tamanho) para exibição e
--    substituição. Idempotente — colunas já podem existir.
begin;

-- Equipe: acesso ativo por padrão. Bloqueio = ativo=false + ban no auth.
alter table public.usuarios
  add column if not exists ativo boolean not null default true;

create index if not exists idx_usuarios_ativo on public.usuarios (ativo);

-- Base de conhecimento: metadados do arquivo armazenado.
alter table public.documentos
  add column if not exists arquivo_path text,
  add column if not exists arquivo_mime text,
  add column if not exists arquivo_tamanho bigint;

insert into public._iex_migrations (name, applied_at)
select '0113_equipe_kb.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0113_equipe_kb.sql');

commit;
