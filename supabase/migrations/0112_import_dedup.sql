-- 0112_import_dedup.sql
-- Frente C — Importação: evitar propostas duplicadas ao reimportar o mesmo arquivo.
--
-- A deduplicação é feita na aplicação (compara a chave abaixo contra as propostas
-- já importadas antes de confirmar). Esta migration adiciona uma rede de segurança
-- no banco: uma coluna GERADA (import_key) e um índice único parcial, para que uma
-- eventual corrida (dois envios simultâneos) não crie duplicatas.
--
-- import_key é GENERATED ALWAYS — nenhum código precisa escrevê-la, então o app
-- funciona igual com ou sem esta migration aplicada. A chave só existe para
-- propostas importadas (numero começando por 'IMP-'); propostas normais ficam NULL
-- e nunca colidem entre si.
begin;

alter table public.propostas
  add column if not exists import_key text
  generated always as (
    case
      when numero like 'IMP-%' then
        md5(
          lower(btrim(coalesce(cliente_nome, ''))) || '|' ||
          lower(btrim(coalesce(empreendimento, ''))) || '|' ||
          round(coalesce(valor_final, 0))::bigint::text || '|' ||
          coalesce(data_criacao::text, '')
        )
      else null
    end
  ) stored;

-- Índice único parcial: garante unicidade apenas entre propostas importadas.
create unique index if not exists uq_propostas_import_key
  on public.propostas(import_key)
  where import_key is not null;

insert into public._iex_migrations (name, applied_at)
select '0112_import_dedup.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0112_import_dedup.sql');

commit;
