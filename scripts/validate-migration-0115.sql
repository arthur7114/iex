\set ON_ERROR_STOP on

create role anon;
create role authenticated;
create schema auth;
create extension if not exists pgcrypto;

create function auth.uid()
returns uuid
language sql
stable
as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;

create table public.propostas (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  versao_atual integer,
  cliente_id uuid,
  obra_id uuid,
  cliente_nome text,
  empreendimento text,
  tipo text,
  cidade text,
  uf text,
  area numeric,
  pavimentos integer,
  padrao text,
  fase text,
  disciplinas text[] default '{}',
  complexidade jsonb,
  valor_sugerido numeric default 0,
  valor_final numeric default 0,
  status text,
  responsavel_id uuid,
  responsavel_nome text,
  origem text,
  forma_pagamento text,
  parcelas jsonb,
  prazo_execucao text,
  validade text,
  premissas text,
  exclusoes text,
  observacoes text,
  apresentacao text,
  proximos_passos text,
  wizard_step integer
);

create table public.disciplinas (
  id text primary key,
  escopo_padrao text[] not null default '{}'
);

create table public.proposta_itens (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id),
  disciplina_id text,
  disciplina_nome text,
  valor_sugerido numeric,
  valor_final numeric,
  justificativa text,
  escopo text[] not null default '{}',
  ordem integer
);

create table public.proposta_eventos (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id),
  usuario_id uuid,
  usuario_nome text,
  acao text,
  data timestamptz not null default now()
);

create table public.modelos_proposta (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  premissas text,
  exclusoes text,
  forma_pagamento_padrao text,
  prazo_execucao_padrao text,
  validade_padrao text,
  padrao boolean not null default false
);

create table public.versoes_proposta (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id),
  versao integer not null,
  snapshot jsonb not null,
  valor_total numeric not null,
  gerado_por uuid,
  created_at timestamptz not null default now()
);

create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text
);

create table public._iex_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

insert into public.propostas (id, numero, versao_atual)
values (
  '10000000-0000-0000-0000-000000000001',
  'PRP-2026-0001',
  0
);

insert into public.versoes_proposta (
  proposta_id,
  versao,
  snapshot,
  valor_total,
  gerado_por
)
values (
  '10000000-0000-0000-0000-000000000001',
  1,
  '{"numero":"PRP-2026-0001","cliente":"Legado"}',
  1000,
  null
);

insert into public.disciplinas (id, escopo_padrao)
values ('sanitaria', array['Escopo sanitário legado']);

insert into public.proposta_itens (
  proposta_id,
  disciplina_id,
  disciplina_nome,
  valor_sugerido,
  valor_final,
  escopo,
  ordem
)
values (
  '10000000-0000-0000-0000-000000000001',
  'sanitaria',
  'Sanitária',
  1000,
  1000,
  '{}',
  0
);

insert into public.modelos_proposta (nome, padrao)
values ('Modelo antigo', true);

insert into public.usuarios (nome, email)
values ('Aledri', 'alderi@iexprojetos.com');

\i supabase/migrations/0115_padronizacao_propostas.sql

do $$
declare
  v_snapshot_antes jsonb;
  v_codigo text;
  v_result record;
begin
  select snapshot into v_snapshot_antes
  from public.versoes_proposta
  where proposta_id = '10000000-0000-0000-0000-000000000001'
    and versao = 1;

  if v_snapshot_antes <> '{"numero":"PRP-2026-0001","cliente":"Legado"}'::jsonb then
    raise exception 'Snapshot legado foi alterado';
  end if;

  if (select numero from public.propostas where id = '10000000-0000-0000-0000-000000000001')
      <> 'PRP-2026-0001' then
    raise exception 'Código legado foi alterado';
  end if;

  if (select versao_atual from public.propostas where id = '10000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Versão atual não foi retropreenchida';
  end if;

  v_codigo := public.fn_proximo_numero_proposta();
  if v_codigo !~ '^[0-9]{8}-01$' then
    raise exception 'Código diário inválido: %', v_codigo;
  end if;

  select * into v_result
  from public.fn_snapshot_versao_proposta(
    '10000000-0000-0000-0000-000000000001',
    '{"schemaVersion":2,"doc":{"numero":"PRP-2026-0001","versao":1},"empresa":{"razaoSocial":"IEX"}}',
    1200,
    null
  );

  if v_result.versao <> 2
      or (v_result.snapshot #>> '{doc,versao}')::integer <> 2 then
    raise exception 'Snapshot atômico inválido';
  end if;

  if (select nome from public.usuarios where lower(email) = 'alderi@iexprojetos.com') <> 'Alderi' then
    raise exception 'Nome de Alderi não foi corrigido';
  end if;

  if (
    select escopo
    from public.proposta_itens
    where proposta_id = '10000000-0000-0000-0000-000000000001'
  ) <> array['Escopo sanitário legado'] then
    raise exception 'Escopo legado não foi materializado antes da revisão do catálogo';
  end if;
end;
$$;

do $$
declare
  v_finalizada record;
  v_editada record;
begin
  select * into v_finalizada
  from public.fn_finalizar_proposta_versionada(
    null,
    '{
      "clienteNome":"Cliente transacional",
      "empreendimento":"Obra transacional",
      "tipo":"Condomínio",
      "cidade":"Fortaleza",
      "uf":"CE",
      "area":100,
      "pavimentos":2,
      "padrao":"Médio",
      "fase":"Executivo",
      "disciplinas":["Sanitária"],
      "complexidade":null,
      "valorSugerido":2000,
      "valorFinal":2000,
      "origem":"Indicação",
      "formaPagamento":"40/40/20",
      "parcelas":[],
      "prazoExecucao":"30 dias úteis",
      "validade":"20 dias corridos",
      "premissas":"Premissa",
      "exclusoes":"Exclusão",
      "observacoes":"",
      "apresentacao":"Apresentação",
      "responsavelId":null,
      "responsavelNome":"Arthur",
      "itens":[{
        "disciplinaId":"sanitaria",
        "disciplina":"Sanitária",
        "tituloProposta":"Projeto sanitário",
        "valorSugerido":2000,
        "valorFinal":2000,
        "justificativa":"",
        "escopo":["Item materializado"]
      }]
    }'::jsonb,
    '{"schemaVersion":2,"doc":{"numero":"","versao":0},"empresa":{"razaoSocial":"IEX"}}',
    2000,
    null
  );

  if v_finalizada.versao <> 1
      or v_finalizada.codigo !~ '^[0-9]{8}-[0-9]{2,}$'
      or v_finalizada.snapshot #>> '{doc,numero}' <> v_finalizada.codigo then
    raise exception 'Finalização transacional V1 inválida';
  end if;

  select * into v_editada
  from public.fn_finalizar_proposta_versionada(
    v_finalizada.id,
    '{
      "clienteNome":"Cliente transacional",
      "empreendimento":"Obra transacional V2",
      "tipo":"Condomínio",
      "cidade":"Fortaleza",
      "uf":"CE",
      "area":100,
      "pavimentos":2,
      "padrao":"Médio",
      "fase":"Executivo",
      "disciplinas":["Sanitária"],
      "complexidade":null,
      "valorSugerido":2200,
      "valorFinal":2200,
      "origem":"Indicação",
      "formaPagamento":"40/40/20",
      "parcelas":[],
      "prazoExecucao":"30 dias úteis",
      "validade":"20 dias corridos",
      "premissas":"Premissa V2",
      "exclusoes":"Exclusão",
      "observacoes":"",
      "apresentacao":"Apresentação",
      "responsavelId":null,
      "responsavelNome":"Arthur",
      "itens":[{
        "disciplinaId":"sanitaria",
        "disciplina":"Sanitária",
        "tituloProposta":"Projeto sanitário",
        "valorSugerido":2200,
        "valorFinal":2200,
        "justificativa":"",
        "escopo":["Item V2"]
      }]
    }'::jsonb,
    '{"schemaVersion":2,"doc":{"numero":"","versao":0},"empresa":{"razaoSocial":"IEX V2"}}',
    2200,
    null
  );

  if v_editada.versao <> 2
      or (select count(*) from public.versoes_proposta where proposta_id = v_finalizada.id) <> 2
      or (select snapshot #>> '{empresa,razaoSocial}' from public.versoes_proposta where proposta_id = v_finalizada.id and versao = 1) <> 'IEX' then
    raise exception 'Finalização transacional V2 ou imutabilidade inválida';
  end if;
end;
$$;

create table public._teste_codigos_0115 (
  codigo text primary key
);

select '0115 OK' as resultado;
