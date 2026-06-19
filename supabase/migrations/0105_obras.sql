-- 0105_obras.sql
-- Entidade Obra (empreendimento/projeto) sob o Cliente.
-- 1 cliente -> N obras; a proposta/orçamento pertence a uma obra.
-- A proposta mantém os campos do empreendimento como snapshot (imutabilidade do
-- documento) e ganha obra_id apontando para a obra de origem.

begin;

create table if not exists public.obras (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  nome          text not null,
  tipo          text,
  cidade        text,
  uf            text,
  endereco      text,
  area          numeric not null default 0,
  pavimentos    integer,
  padrao        text,
  fase          text,
  urgencia      text,
  repetitividade text,
  observacoes   text,
  arquivada     boolean not null default false,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_obras_cliente on public.obras(cliente_id);

-- RLS: mesmo padrão das demais tabelas (acesso total para authenticated).
alter table public.obras enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'obras' and policyname = 'auth_all'
  ) then
    create policy auth_all on public.obras
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Trigger de updated_at (mesma função usada nas outras tabelas).
drop trigger if exists set_updated_at on public.obras;
create trigger set_updated_at before update on public.obras
  for each row execute function public.set_updated_at();

-- Vínculo proposta -> obra.
alter table public.propostas
  add column if not exists obra_id uuid references public.obras(id) on delete set null;
create index if not exists idx_propostas_obra on public.propostas(obra_id);

-- Backfill (idempotente — só toca propostas com obra_id nulo):
--  * Propostas COM empreendimento: uma obra por (cliente_id, empreendimento).
--  * Propostas SEM empreendimento (NULL/''): uma obra por proposta (evita fundir
--    projetos independentes numa obra genérica).
do $$
declare
  r record;
  v_obra uuid;
begin
  for r in
    select distinct cliente_id, empreendimento as emp
    from public.propostas
    where cliente_id is not null and obra_id is null
      and coalesce(nullif(empreendimento, ''), '') <> ''
  loop
    insert into public.obras (cliente_id, nome, tipo, cidade, uf, area, pavimentos, padrao, fase)
    select r.cliente_id, r.emp, p.tipo, p.cidade, p.uf, coalesce(p.area, 0), p.pavimentos, p.padrao, p.fase
    from public.propostas p
    where p.cliente_id = r.cliente_id and p.empreendimento = r.emp
    order by p.data_criacao desc nulls last
    limit 1
    returning id into v_obra;

    update public.propostas
    set obra_id = v_obra
    where cliente_id = r.cliente_id and empreendimento = r.emp and obra_id is null;
  end loop;

  for r in
    select id, cliente_id, numero, tipo, cidade, uf, area, pavimentos, padrao, fase
    from public.propostas
    where cliente_id is not null and obra_id is null
      and coalesce(nullif(empreendimento, ''), '') = ''
  loop
    insert into public.obras (cliente_id, nome, tipo, cidade, uf, area, pavimentos, padrao, fase)
    values (r.cliente_id, 'Obra — ' || r.numero, r.tipo, r.cidade, r.uf, coalesce(r.area, 0), r.pavimentos, r.padrao, r.fase)
    returning id into v_obra;

    update public.propostas set obra_id = v_obra where id = r.id;
  end loop;
end $$;

-- Registro da migration (consistente com as demais).
insert into public._iex_migrations (name, applied_at)
select '0105_obras.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0105_obras.sql');

commit;
