-- 0116_sugestoes_ia.sql
-- Fase 3 (IA) — Persistência das sugestões do copiloto (PRD 006 / 14.2).
--  * sugestoes: uma linha por disciplina sugerida, gravada na FINALIZAÇÃO da
--    proposta (quando proposta_id já existe), junto da auditoria de ajustes.
--    Guarda o que a IA sugeriu para permitir medir aderência (PRD 16.4):
--    valor_total_sugerido (IA) × proposta_itens.valor_final (usuário).
--  * base_recente_qtd / base_antiga_qtd / base_antiga: rastreiam se a sugestão
--    veio de dados dos últimos 12 meses ou de referência secundária (12–36m),
--    exigência explícita do PRD 006 ("declarar quando usa dados antigos").
--  * fonte: 'ia' | 'heuristica' — separa aderência do modelo da aderência do
--    fallback determinístico nas métricas.
--  Migração ADITIVA e idempotente (segue o estilo de 0113/0114/0115).
begin;

create table if not exists public.sugestoes (
  id                       uuid primary key default gen_random_uuid(),
  proposta_id              uuid not null references public.propostas(id) on delete cascade,
  disciplina_id            uuid references public.disciplinas(id) on delete set null,
  disciplina_nome          text not null,
  valor_unitario_sugerido  numeric(14,2) not null default 0,
  valor_total_sugerido     numeric(14,2) not null default 0,
  fatores_considerados     jsonb not null default '{}'::jsonb,
  justificativa            text,
  confianca                integer not null default 0,
  base_recente_qtd         integer not null default 0,
  base_antiga_qtd          integer not null default 0,
  base_antiga              boolean not null default false,
  fonte                    text not null default 'heuristica',
  usuario_id               uuid references public.usuarios(id) on delete set null,
  created_at               timestamptz not null default now()
);

create index if not exists idx_sugestoes_proposta on public.sugestoes (proposta_id);
create index if not exists idx_sugestoes_created on public.sugestoes (created_at desc);
create index if not exists idx_sugestoes_fonte on public.sugestoes (fonte);

-- Uma sugestão por (proposta, disciplina): re-finalizar a proposta atualiza a
-- linha em vez de duplicar, mantendo a métrica de aderência estável.
create unique index if not exists uq_sugestoes_proposta_disciplina
  on public.sugestoes (proposta_id, disciplina_nome);

alter table public.sugestoes enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sugestoes' and policyname = 'auth_all'
  ) then
    create policy auth_all on public.sugestoes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public._iex_migrations (name, applied_at)
select '0116_sugestoes_ia.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0116_sugestoes_ia.sql');

commit;
