-- 0106_pagamento_escopo.sql
-- Suporte a:
--  * Estrutura de pagamento configurável (parcelas/marcos) por proposta — PRD 14.4
--  * Edição de escopo por disciplina, persistida por item — PRD 11.4
begin;

-- Parcelas estruturadas: [{ descricao, percentual, valor, marco }]
alter table public.propostas
  add column if not exists parcelas jsonb;

-- Escopo editável por disciplina (snapshot na proposta).
alter table public.proposta_itens
  add column if not exists escopo text[] not null default '{}'::text[];

insert into public._iex_migrations (name, applied_at)
select '0106_pagamento_escopo.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0106_pagamento_escopo.sql');

commit;
