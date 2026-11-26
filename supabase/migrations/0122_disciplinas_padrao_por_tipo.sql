begin;

alter table public.tipos_empreendimento
  add column if not exists disciplinas_padrao text[] not null default '{}';

insert into public._iex_migrations (name, applied_at)
select '0122_disciplinas_padrao_por_tipo.sql', now()
where not exists (
  select 1 from public._iex_migrations where name = '0122_disciplinas_padrao_por_tipo.sql'
);

notify pgrst, 'reload schema';

commit;
