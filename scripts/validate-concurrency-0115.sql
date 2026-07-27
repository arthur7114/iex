insert into public._teste_codigos_0115 (codigo)
values (public.fn_proximo_numero_proposta());

select *
from public.fn_snapshot_versao_proposta(
  '10000000-0000-0000-0000-000000000001',
  '{"schemaVersion":2,"doc":{"numero":"PRP-2026-0001","versao":1},"empresa":{"razaoSocial":"IEX"}}',
  1200,
  null
);
