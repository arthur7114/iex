-- 0114_notificacoes.sql
-- Frente C (Onda 2) — Notificações reais: sino da topbar + preferências em Configurações.
--  * notificacoes: eventos comerciais (sem_retorno / aprovada / perdida / resumo_semanal).
--    Destinatário = usuario_id (normalmente o responsável pela proposta);
--    usuario_id NULL = notificação visível a todos.
--    Deduplicação por (tipo, proposta_id) via índice único parcial — evita repetir
--    a mesma notificação a cada sincronização.
--  * notificacao_preferencias: preferências por usuário (quais tipos deseja receber).
--  * RLS: mesmo padrão auth_all das demais tabelas (aplicação single-tenant, todos
--    os usuários autenticados são confiáveis — a segregação por destinatário é feita
--    na aplicação, como em obras/propostas).
--  Migração ADITIVA e idempotente (segue o estilo de 0105/0106/0112/0113).
begin;

-- Notificações -------------------------------------------------------------
create table if not exists public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references public.usuarios(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  descricao   text,
  proposta_id uuid references public.propostas(id) on delete cascade,
  href        text,
  lida        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notificacoes_usuario on public.notificacoes (usuario_id);
create index if not exists idx_notificacoes_lida on public.notificacoes (lida);
create index if not exists idx_notificacoes_created on public.notificacoes (created_at desc);

-- Uma notificação por (tipo, proposta): evita duplicar "sem retorno" ao ressincronizar.
create unique index if not exists uq_notificacoes_tipo_proposta
  on public.notificacoes (tipo, proposta_id)
  where proposta_id is not null;

alter table public.notificacoes enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notificacoes' and policyname = 'auth_all'
  ) then
    create policy auth_all on public.notificacoes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Preferências por usuário --------------------------------------------------
create table if not exists public.notificacao_preferencias (
  usuario_id     uuid primary key references public.usuarios(id) on delete cascade,
  sem_retorno    boolean not null default true,
  aprovada       boolean not null default true,
  perdida        boolean not null default true,
  resumo_semanal boolean not null default false,
  updated_at     timestamptz not null default now()
);

alter table public.notificacao_preferencias enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notificacao_preferencias' and policyname = 'auth_all'
  ) then
    create policy auth_all on public.notificacao_preferencias
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Trigger de updated_at (mesma função usada nas outras tabelas).
drop trigger if exists set_updated_at on public.notificacao_preferencias;
create trigger set_updated_at before update on public.notificacao_preferencias
  for each row execute function public.set_updated_at();

insert into public._iex_migrations (name, applied_at)
select '0114_notificacoes.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0114_notificacoes.sql');

commit;
