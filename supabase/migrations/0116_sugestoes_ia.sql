-- 0116_sugestoes_ia.sql
-- Fase 3 (IA) — Persistência das sugestões do copiloto (PRD 006 / 14.2).
--  * sugestoes: uma linha por disciplina sugerida, gravada na FINALIZAÇÃO da
--    proposta (quando proposta_id já existe), junto da auditoria de ajustes.
--    Guarda o que a IA sugeriu para permitir medir aderência (PRD 16.4):
--    valor_total_sugerido (IA) × proposta_itens.valor_final (usuário).
--  * base_recente_qtd / base_antiga_qtd / base_antiga: rastreiam se a sugestão
--    veio de dados dos últimos 12 meses ou de referência secundária (12–36m),
--    exigência explícita do PRD 006 ("declarar quando usa dados antigos").
--  * fonte: 'ia' | 'heuristica' — coluna reservada para, no futuro, separar a
--    aderência do modelo da aderência do fallback determinístico. Nenhuma
--    métrica atual lê esta coluna.
--  Gravação: DELETE de todas as linhas da proposta + INSERT das novas (mesmo
--  padrão de proposta_itens em 0115). Nomes de disciplina podem se repetir
--  dentro da mesma proposta (ver 221cb66), então não há chave natural estável
--  por (proposta, nome) — daí o índice comum, não único.
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

-- (proposta_id, disciplina_id) atende também as buscas só por proposta_id
-- (coluna à esquerda), então não há índice separado de proposta_id.
create index if not exists idx_sugestoes_proposta_disciplina
  on public.sugestoes (proposta_id, disciplina_id);
create index if not exists idx_sugestoes_created on public.sugestoes (created_at desc);
create index if not exists idx_sugestoes_fonte on public.sugestoes (fonte);

-- Resquícios de versões anteriores desta migração (índice único por nome de
-- disciplina), que impediriam o INSERT com nomes repetidos.
drop index if exists public.uq_sugestoes_proposta_disciplina;
drop index if exists public.idx_sugestoes_proposta;

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
