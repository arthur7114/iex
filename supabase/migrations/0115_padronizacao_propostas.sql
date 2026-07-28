-- 0115_padronizacao_propostas.sql
-- Padronização de propostas futuras:
--  * código diário AAAAMMDD-NN, transacional e no fuso de Fortaleza;
--  * versões atômicas e snapshots completos (documento + branding);
--  * apresentação, títulos comerciais e modelos de conteúdo;
--  * nenhuma reescrita de propostas, itens ou snapshots já emitidos.
begin;

alter table public.propostas
  add column if not exists versao_atual integer not null default 0,
  add column if not exists apresentacao text;

alter table public.disciplinas
  add column if not exists titulo_proposta text;

alter table public.proposta_itens
  add column if not exists titulo_proposta text;

alter table public.modelos_proposta
  add column if not exists apresentacao text,
  add column if not exists observacoes_padrao text;

create unique index if not exists uq_propostas_numero
  on public.propostas (numero);

create unique index if not exists uq_versoes_proposta_numero
  on public.versoes_proposta (proposta_id, versao);

-- Snapshots são somente leitura para a aplicação. A inserção passa
-- exclusivamente pela função security-definer abaixo.
revoke insert, update, delete on public.versoes_proposta from anon, authenticated;
grant select on public.versoes_proposta to authenticated;

update public.propostas p
set versao_atual = coalesce(v.ultima_versao, 0)
from (
  select proposta_id, max(versao)::integer as ultima_versao
  from public.versoes_proposta
  group by proposta_id
) v
where p.id = v.proposta_id
  and p.versao_atual < v.ultima_versao;

create table if not exists public.contadores_proposta_diarios (
  data_referencia date primary key,
  ultimo_sequencial integer not null check (ultimo_sequencial > 0),
  updated_at timestamptz not null default now()
);

alter table public.contadores_proposta_diarios enable row level security;

create or replace function public.fn_proximo_numero_proposta()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_data date;
  v_sequencial integer;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada obrigatória';
  end if;

  v_data := (timezone('America/Fortaleza', now()))::date;

  insert into public.contadores_proposta_diarios (
    data_referencia,
    ultimo_sequencial,
    updated_at
  )
  values (v_data, 1, now())
  on conflict (data_referencia)
  do update set
    ultimo_sequencial = public.contadores_proposta_diarios.ultimo_sequencial + 1,
    updated_at = now()
  returning ultimo_sequencial into v_sequencial;

  return to_char(v_data, 'YYYYMMDD')
    || '-'
    || lpad(v_sequencial::text, 2, '0');
end;
$$;

revoke all on function public.fn_proximo_numero_proposta() from public;
grant execute on function public.fn_proximo_numero_proposta() to authenticated;

create or replace function public.fn_snapshot_versao_proposta(
  p_proposta_id uuid,
  p_snapshot jsonb,
  p_valor_total numeric,
  p_gerado_por uuid default null
)
returns table (versao integer, snapshot jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_versao integer;
  v_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada obrigatória';
  end if;

  update public.propostas
  set versao_atual = versao_atual + 1
  where id = p_proposta_id
  returning versao_atual into v_versao;

  if v_versao is null then
    raise exception 'Proposta não encontrada';
  end if;

  v_snapshot := jsonb_set(
    jsonb_set(
      coalesce(p_snapshot, '{}'::jsonb),
      '{schemaVersion}',
      '2'::jsonb,
      true
    ),
    '{doc,versao}',
    to_jsonb(v_versao),
    true
  );

  insert into public.versoes_proposta (
    proposta_id,
    versao,
    snapshot,
    valor_total,
    gerado_por
  )
  values (
    p_proposta_id,
    v_versao,
    v_snapshot,
    p_valor_total,
    p_gerado_por
  );

  return query select v_versao, v_snapshot;
end;
$$;

revoke all on function public.fn_snapshot_versao_proposta(uuid, jsonb, numeric, uuid) from public;
grant execute on function public.fn_snapshot_versao_proposta(uuid, jsonb, numeric, uuid) to authenticated;

-- Persiste proposta, itens e snapshot na mesma transação. A aplicação envia o
-- documento já montado com o branding vigente; a função injeta código e versão.
create or replace function public.fn_finalizar_proposta_versionada(
  p_proposta_id uuid,
  p_proposta jsonb,
  p_snapshot jsonb,
  p_valor_total numeric,
  p_gerado_por uuid default null
)
returns table (id uuid, codigo text, versao integer, snapshot jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_numero text;
  v_versao integer;
  v_snapshot jsonb;
  v_acao text;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada obrigatória';
  end if;

  if p_proposta is null
      or jsonb_typeof(coalesce(p_proposta->'itens', 'null'::jsonb)) <> 'array' then
    raise exception 'Dados da proposta inválidos';
  end if;

  if p_proposta_id is null then
    v_id := gen_random_uuid();
    v_numero := public.fn_proximo_numero_proposta();
    v_acao := 'Proposta criada';

    insert into public.propostas (
      id,
      numero,
      cliente_id,
      obra_id,
      cliente_nome,
      empreendimento,
      tipo,
      cidade,
      uf,
      area,
      pavimentos,
      padrao,
      fase,
      disciplinas,
      complexidade,
      valor_sugerido,
      valor_final,
      status,
      responsavel_id,
      responsavel_nome,
      origem,
      forma_pagamento,
      parcelas,
      prazo_execucao,
      validade,
      premissas,
      exclusoes,
      observacoes,
      apresentacao,
      proximos_passos,
      wizard_step,
      versao_atual
    )
    values (
      v_id,
      v_numero,
      nullif(p_proposta->>'clienteId', '')::uuid,
      nullif(p_proposta->>'obraId', '')::uuid,
      p_proposta->>'clienteNome',
      p_proposta->>'empreendimento',
      p_proposta->>'tipo',
      p_proposta->>'cidade',
      p_proposta->>'uf',
      coalesce((p_proposta->>'area')::numeric, 0),
      nullif(p_proposta->>'pavimentos', '')::integer,
      nullif(p_proposta->>'padrao', ''),
      nullif(p_proposta->>'fase', ''),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(p_proposta->'disciplinas', '[]'::jsonb))),
        '{}'::text[]
      ),
      case
        when jsonb_typeof(p_proposta->'complexidade') = 'object'
          then p_proposta->'complexidade'
        else null
      end,
      coalesce((p_proposta->>'valorSugerido')::numeric, 0),
      coalesce((p_proposta->>'valorFinal')::numeric, 0),
      'Em elaboração',
      nullif(p_proposta->>'responsavelId', '')::uuid,
      nullif(p_proposta->>'responsavelNome', ''),
      nullif(p_proposta->>'origem', ''),
      nullif(p_proposta->>'formaPagamento', ''),
      case
        when jsonb_typeof(p_proposta->'parcelas') = 'array'
          then p_proposta->'parcelas'
        else null
      end,
      nullif(p_proposta->>'prazoExecucao', ''),
      nullif(p_proposta->>'validade', ''),
      p_proposta->>'premissas',
      p_proposta->>'exclusoes',
      p_proposta->>'observacoes',
      p_proposta->>'apresentacao',
      'Proposta gerada. Aguardando envio.',
      8,
      0
    );
  else
    v_id := p_proposta_id;
    v_acao := 'Proposta editada';

    update public.propostas
    set
      cliente_id = nullif(p_proposta->>'clienteId', '')::uuid,
      obra_id = nullif(p_proposta->>'obraId', '')::uuid,
      cliente_nome = p_proposta->>'clienteNome',
      empreendimento = p_proposta->>'empreendimento',
      tipo = p_proposta->>'tipo',
      cidade = p_proposta->>'cidade',
      uf = p_proposta->>'uf',
      area = coalesce((p_proposta->>'area')::numeric, 0),
      pavimentos = nullif(p_proposta->>'pavimentos', '')::integer,
      padrao = nullif(p_proposta->>'padrao', ''),
      fase = nullif(p_proposta->>'fase', ''),
      disciplinas = coalesce(
        array(select jsonb_array_elements_text(coalesce(p_proposta->'disciplinas', '[]'::jsonb))),
        '{}'::text[]
      ),
      complexidade = case
        when jsonb_typeof(p_proposta->'complexidade') = 'object'
          then p_proposta->'complexidade'
        else null
      end,
      valor_sugerido = coalesce((p_proposta->>'valorSugerido')::numeric, 0),
      valor_final = coalesce((p_proposta->>'valorFinal')::numeric, 0),
      responsavel_id = nullif(p_proposta->>'responsavelId', '')::uuid,
      responsavel_nome = nullif(p_proposta->>'responsavelNome', ''),
      origem = nullif(p_proposta->>'origem', ''),
      forma_pagamento = nullif(p_proposta->>'formaPagamento', ''),
      parcelas = case
        when jsonb_typeof(p_proposta->'parcelas') = 'array'
          then p_proposta->'parcelas'
        else null
      end,
      prazo_execucao = nullif(p_proposta->>'prazoExecucao', ''),
      validade = nullif(p_proposta->>'validade', ''),
      premissas = p_proposta->>'premissas',
      exclusoes = p_proposta->>'exclusoes',
      observacoes = p_proposta->>'observacoes',
      apresentacao = p_proposta->>'apresentacao'
    where public.propostas.id = v_id
    returning public.propostas.numero into v_numero;

    if v_numero is null then
      raise exception 'Proposta não encontrada';
    end if;

    delete from public.proposta_itens
    where proposta_id = v_id;
  end if;

  insert into public.proposta_itens (
    proposta_id,
    disciplina_id,
    disciplina_nome,
    titulo_proposta,
    valor_sugerido,
    valor_final,
    justificativa,
    escopo,
    ordem
  )
  select
    v_id,
    nullif(item->>'disciplinaId', ''),
    item->>'disciplina',
    coalesce(nullif(item->>'tituloProposta', ''), item->>'disciplina'),
    coalesce((item->>'valorSugerido')::numeric, 0),
    coalesce((item->>'valorFinal')::numeric, 0),
    nullif(item->>'justificativa', ''),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(item->'escopo', '[]'::jsonb))),
      '{}'::text[]
    ),
    (ordem - 1)::integer
  from jsonb_array_elements(p_proposta->'itens') with ordinality as itens(item, ordem);

  update public.propostas
  set versao_atual = versao_atual + 1
  where public.propostas.id = v_id
  returning versao_atual into v_versao;

  v_snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(p_snapshot, '{}'::jsonb),
        '{schemaVersion}',
        '2'::jsonb,
        true
      ),
      '{doc,numero}',
      to_jsonb(v_numero),
      true
    ),
    '{doc,versao}',
    to_jsonb(v_versao),
    true
  );

  insert into public.versoes_proposta (
    proposta_id,
    versao,
    snapshot,
    valor_total,
    gerado_por
  )
  values (
    v_id,
    v_versao,
    v_snapshot,
    p_valor_total,
    p_gerado_por
  );

  insert into public.proposta_eventos (
    proposta_id,
    usuario_id,
    usuario_nome,
    acao
  )
  values (
    v_id,
    nullif(p_proposta->>'responsavelId', '')::uuid,
    nullif(p_proposta->>'responsavelNome', ''),
    v_acao
  );

  return query select v_id, v_numero, v_versao, v_snapshot;
end;
$$;

revoke all on function public.fn_finalizar_proposta_versionada(uuid, jsonb, jsonb, numeric, uuid) from public;
grant execute on function public.fn_finalizar_proposta_versionada(uuid, jsonb, jsonb, numeric, uuid) to authenticated;

-- O renderer anterior recorria ao cadastro quando o item tinha escopo vazio.
-- Materializamos esse resultado antes de revisar o catálogo, preservando a
-- saída lógica das propostas legadas sem fazê-las ler os padrões novos.
update public.proposta_itens pi
set escopo = d.escopo_padrao
from public.disciplinas d
where pi.disciplina_id = d.id
  and coalesce(cardinality(pi.escopo), 0) = 0;

-- Títulos comerciais e escopos para propostas FUTURAS. Itens existentes já
-- carregam seus próprios snapshots e não são atualizados nesta migration.
update public.disciplinas
set
  titulo_proposta = 'Projeto de instalações de sistema de climatização — Splits / VRF',
  escopo_padrao = array[
    'Dimensionamento e definição dos equipamentos de climatização.',
    'Rede de tubulações frigoríferas, drenos e pontos de alimentação específicos.',
    'Compatibilização dos sistemas com os ambientes atendidos.',
    'Detalhamento executivo das instalações.'
  ]::text[]
where id = 'climatizacao-splits-vrf';

update public.disciplinas
set
  titulo_proposta = 'Projeto de instalações de exaustão e ventilação mecânica',
  escopo_padrao = array[
    'Dimensionamento e definição de exaustores e ventiladores.',
    'Rede de dutos de insuflamento, exaustão e renovação de ar.',
    'Distribuição de ar por grelhas, difusores ou venezianas.',
    'Atendimento às áreas técnicas identificadas no empreendimento.'
  ]::text[]
where id = 'exaustao-ventilacao';

update public.disciplinas
set
  titulo_proposta = 'Projeto de instalações elétricas de baixa tensão (BT)',
  escopo_padrao = array[
    'Iluminação e tomadas de uso geral e específico.',
    'Alimentadores de máquinas, climatização e quadros elétricos.',
    'Dimensionamento e detalhamento de diagramas e quadros elétricos.',
    'Detalhamento executivo das instalações de baixa tensão.'
  ]::text[]
where id = 'eletrica-bt';

update public.disciplinas
set
  titulo_proposta = 'Projeto de cabeamento estruturado — dados e voz',
  escopo_padrao = array[
    'Quadros, racks e infraestrutura de telecomunicações.',
    'Tubulações, pontos de dados e encaminhamentos principais.',
    'Infraestrutura para as unidades consumidoras.',
    'Detalhamento executivo conforme as normas aplicáveis.'
  ]::text[]
where id = 'cabeamento-estruturado';

update public.disciplinas
set
  titulo_proposta = 'Projeto de sistema de monitoramento CFTV',
  escopo_padrao = array[
    'Indicação dos tipos e das quantidades de câmeras.',
    'Posicionamento dos pontos de vigilância.',
    'Infraestrutura para racks e equipamentos de gravação.',
    'Compatibilização com o cabeamento estruturado.'
  ]::text[]
where id = 'cftv';

update public.disciplinas
set
  titulo_proposta = 'Projeto de detecção, alarme e combate a incêndio',
  escopo_padrao = array[
    'Rede de detecção e alarme de incêndio.',
    'Iluminação de emergência, hidrantes, extintores e rotas de fuga.',
    'Atendimento às exigências normativas aplicáveis.',
    'Apoio técnico ao processo de aprovação junto ao Corpo de Bombeiros.'
  ]::text[]
where id = 'incendio';

update public.disciplinas
set
  titulo_proposta = 'Projeto de SPDA — Sistema de Proteção contra Descargas Atmosféricas',
  escopo_padrao = array[
    'Malha de captação e condutores de descida.',
    'Sistema de aterramento e equipotencialização.',
    'Especificação de equipamentos, conexões e sinalização.',
    'Detalhamento executivo do sistema de proteção.'
  ]::text[]
where id = 'spda';

update public.disciplinas
set
  titulo_proposta = 'Projeto de instalações hidráulicas — água fria',
  escopo_padrao = array[
    'Rede de distribuição de água fria.',
    'Caixas-d’água, cisternas e pontos de consumo.',
    'Registros e demais dispositivos hidráulicos.',
    'Detalhamento executivo das instalações.'
  ]::text[]
where id = 'hidraulica';

update public.disciplinas
set
  titulo_proposta = 'Projeto de instalações sanitárias — esgoto',
  escopo_padrao = array[
    'Rede de coleta e encaminhamento de esgoto sanitário.',
    'Atendimento a banheiros, copas, pias e drenos.',
    'Ligação à rede pública, quando aplicável.',
    'Detalhamento executivo das instalações.'
  ]::text[]
where id = 'sanitaria';

update public.disciplinas
set
  titulo_proposta = 'Projeto de instalações de águas pluviais',
  escopo_padrao = array[
    'Captação e condução das águas pluviais.',
    'Condutores verticais e horizontais.',
    'Destinação para sarjetas, reservatórios ou sistemas de reuso.',
    'Detalhamento executivo das instalações.'
  ]::text[]
where id = 'aguas-pluviais';

update public.disciplinas
set
  titulo_proposta = 'Projeto de instalações de gás GLP ou natural',
  escopo_padrao = array[
    'Rede de tubulações para gás GLP ou natural.',
    'Pontos de consumo e dispositivos de segurança.',
    'Sistema individual ou coletivo, conforme o empreendimento.',
    'Detalhamento técnico da infraestrutura.'
  ]::text[]
where id = 'gas';

update public.disciplinas
set
  titulo_proposta = 'Projeto de cálculo estrutural em concreto',
  escopo_padrao = array[
    'Dimensionamento de fundações.',
    'Dimensionamento de pilares, vigas e lajes.',
    'Definição dos demais elementos estruturais necessários.',
    'Detalhamento executivo da estrutura.'
  ]::text[]
where id = 'estrutural-concreto';

update public.disciplinas
set
  titulo_proposta = 'Serviços de perfuração do solo para sondagem',
  escopo_padrao = array[
    'Perfuração do solo nos pontos definidos.',
    'Caracterização das camadas do terreno.',
    'Identificação do nível do lençol freático, quando encontrado.',
    'Emissão do relatório técnico de sondagem.'
  ]::text[]
where id = 'sondagem';

update public.disciplinas
set
  titulo_proposta = 'Projeto de instalações de energia fotovoltaica',
  escopo_padrao = array[
    'Dimensionamento de módulos, inversores e proteções.',
    'Definição do arranjo e da disposição dos painéis.',
    'Infraestrutura de conexão e encaminhamento elétrico.',
    'Integração com a entrada de energia do empreendimento.'
  ]::text[]
where id = 'fotovoltaica';

update public.disciplinas
set
  titulo_proposta = 'Projeto estrutural',
  escopo_padrao = array[
    'Dimensionamento de fundações e elementos estruturais.',
    'Detalhamento de pilares, vigas e lajes.',
    'Compatibilização com as demais disciplinas.',
    'Emissão da documentação executiva da estrutura.'
  ]::text[]
where id = 'estrutura';

update public.disciplinas
set
  titulo_proposta = 'Projeto de instalações de subestação elétrica abrigada',
  escopo_padrao = array[
    'Estudo e definição da capacidade da subestação.',
    'Dimensionamento dos equipamentos de proteção e manobra.',
    'Rede de alimentação, aterramento e acessórios.',
    'Documentação técnica para o processo de aprovação junto à concessionária.'
  ]::text[]
where id = 'projeto-de-instalacoes-de-subestacao-eletrica-abrigada';

update public.disciplinas
set
  titulo_proposta = 'Projeto de instalações de grupo gerador',
  escopo_padrao = array[
    'Dimensionamento e definição da capacidade do grupo gerador.',
    'Especificação dos equipamentos de proteção, comando e transferência.',
    'Infraestrutura elétrica, aterramento e acessórios.',
    'Detalhamento executivo da instalação.'
  ]::text[]
where id = 'projeto-de-instalacoes-de-grupo-gerador';

update public.disciplinas
set
  titulo_proposta = 'Projeto de cálculo estrutural metálico',
  escopo_padrao = array[
    'Dimensionamento de pilares, vigas, terças e tesouras.',
    'Dimensionamento de ligações, contraventamentos e esticadores.',
    'Definição dos elementos de amarração e estabilidade.',
    'Detalhamento executivo da estrutura metálica.'
  ]::text[]
where id = 'projeto-de-calculo-estrutural-metalico';

update public.modelos_proposta
set padrao = false
where padrao = true
  and nome <> 'Modelo padrão IEX';

insert into public.modelos_proposta (nome, padrao)
select 'Modelo padrão IEX', true
where not exists (
  select 1
  from public.modelos_proposta
  where nome = 'Modelo padrão IEX'
);

update public.modelos_proposta
set
  apresentacao = 'A IEX Projetos desenvolve projetos de engenharia de forma integrada, com foco na compatibilização entre disciplinas, no atendimento às normas técnicas e na produção de documentação executiva clara para apoiar a execução da obra. Apresentamos, a seguir, o escopo, o investimento e as condições comerciais e técnicas dos serviços selecionados.',
  premissas = E'Projeto executivo detalhado, preferencialmente desenvolvido em Revit, quando aplicável.\nMemorial técnico descritivo e especificações de materiais.\nPlanilha quantitativa de materiais.\nEntrega de arquivos digitais nos formatos DWG, IFC e PDF, conforme o escopo contratado.\nFornecimento de ART junto ao CREA-CE para os serviços contratados.\nObservância das leis, dos regulamentos e das normas técnicas aplicáveis.\nManutenção do sigilo sobre dados e informações recebidos para o desenvolvimento dos serviços.',
  exclusoes = E'Taxas e emolumentos de aprovação em órgãos fiscalizadores, salvo quando indicados expressamente.\nProjetos e serviços não listados no escopo desta proposta.\nAlterações de escopo posteriores à aprovação formal da proposta.\nLevantamentos, laudos e estudos complementares não descritos nesta proposta.\nPrazos internos de análise de concessionárias e órgãos públicos.',
  observacoes_padrao = null,
  forma_pagamento_padrao = '40/40/20',
  prazo_execucao_padrao = '30 dias úteis',
  validade_padrao = '20 dias corridos',
  padrao = true
where nome = 'Modelo padrão IEX';

insert into public.modelos_proposta (nome, padrao)
select 'Modelo Condomínio', false
where not exists (
  select 1
  from public.modelos_proposta
  where nome = 'Modelo Condomínio'
);

-- `nome` não possui restrição única no schema legado. O fluxo insert-if-missing
-- seguido de update mantém a migration idempotente sem impor um novo contrato.
update public.modelos_proposta
set
  apresentacao = 'A IEX Projetos desenvolve projetos de engenharia de forma integrada, com foco na compatibilização entre disciplinas, no atendimento às normas técnicas e na produção de documentação executiva clara para apoiar a execução da obra. Apresentamos, a seguir, o escopo, o investimento e as condições comerciais e técnicas dos serviços selecionados.',
  premissas = E'Projeto executivo detalhado, preferencialmente desenvolvido em Revit, quando aplicável.\nMemorial técnico descritivo e especificações de materiais.\nPlanilha quantitativa de materiais.\nEntrega de arquivos digitais nos formatos DWG, IFC e PDF, conforme o escopo contratado.\nFornecimento de ART junto ao CREA-CE para os serviços contratados.\nConsultoria técnica para os processos de aprovação aplicáveis junto ao CBMCE, à ENEL e à CAGECE.\nObservância das leis, dos regulamentos e das normas técnicas aplicáveis.',
  exclusoes = E'Taxas e emolumentos dos processos de aprovação, salvo quando indicados expressamente.\nProjetos de ETA, ETE, EEE e redes adutoras de água ou esgoto, salvo contratação específica.\nProjetos e serviços não listados no escopo desta proposta.\nAlterações de escopo posteriores à aprovação formal.\nPrazos internos de análise de concessionárias e órgãos públicos.',
  observacoes_padrao = 'Quando os projetos hidrossanitários fizerem parte do escopo, a contratante deverá fornecer as AVTs de água e esgoto emitidas pela CAGECE, quando aplicáveis.',
  forma_pagamento_padrao = '40/40/20',
  prazo_execucao_padrao = '30 dias úteis',
  validade_padrao = '20 dias corridos',
  padrao = false
where nome = 'Modelo Condomínio';

update public.usuarios
set nome = 'Alderi'
where lower(email) = 'alderi@iexprojetos.com'
  and lower(nome) = 'aledri';

insert into public._iex_migrations (name, applied_at)
select '0115_padronizacao_propostas.sql', now()
where not exists (
  select 1
  from public._iex_migrations
  where name = '0115_padronizacao_propostas.sql'
);

commit;
