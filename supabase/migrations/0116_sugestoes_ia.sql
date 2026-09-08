-- 0116_sugestoes_ia.sql
-- Fase 3 (IA) — Índice de apoio para as sugestões do copiloto (PRD 006 / 14.2).
--
-- ATENÇÃO: esta migração NÃO cria `public.sugestoes`. A tabela JÁ EXISTE no
-- banco real desde a construção original do backend, anterior às migrations
-- versionadas deste repositório (que começam em 0105 — de 0001 a 0104 foram
-- aplicadas fora do repo e só constam em `_iex_migrations`). A versão anterior
-- deste arquivo tentava criar a tabela com outros nomes de coluna; como usava
-- `create table if not exists`, teria sido um NO-OP SILENCIOSO: a migração se
-- registraria como aplicada, a tabela continuaria com o schema original e todo
-- INSERT do copiloto falharia por coluna inexistente. Ver docs/12-execution-roadmap.md.
--
-- Schema real de public.sugestoes (verificado no banco em 2026-08-03) e o
-- mapeamento que a aplicação usa (lib/db/sugestoes.ts::registrarSugestoes):
--   id                      uuid        pk
--   proposta_id             uuid        not null, FK propostas(id)
--   disciplina_id           text        FK disciplinas(id)  ← TEXT, não uuid
--   disciplina_nome         text        ← SugestaoDisciplina.nome
--   fonte                   text        not null  ← 'ia' | 'heuristica'
--   valor_unitario_sugerido numeric     ← SugestaoDisciplina.valorUnitarioM2
--   valor_total_sugerido    numeric     ← SugestaoDisciplina.valorTotal
--   multiplicador           numeric     ← CopilotoInput.multiplicadorComplexidade
--   confianca               numeric     ← CopilotoResultado.confianca (0–100)
--   base_recente            integer     ← nº de comparáveis dos últimos 12 meses
--   base_antiga             integer     ← nº de comparáveis de 12–36 meses (CONTAGEM,
--                                         não booleano; "base antiga" é derivado:
--                                         base_recente = 0 e base_antiga > 0)
--   fatores                 jsonb       ← parâmetros considerados (tipo, área, padrão…)
--   entrada                 jsonb       ← snapshot completo do CopilotoInput
--   explicacao              text        ← SugestaoDisciplina.justificativa
--   modelo                  text        ← process.env.OPENAI_MODEL (null na heurística)
--   created_at              timestamptz not null
-- Não existe coluna `usuario_id` nesta tabela — a autoria fica na auditoria
-- (`ajustes_preco` / `logs_uso`), não na sugestão.
--
-- Gravação: DELETE de todas as linhas da proposta + INSERT das novas (mesmo
-- padrão de proposta_itens em 0115). Nomes de disciplina podem se repetir
-- dentro da mesma proposta (ver 221cb66), então não há chave natural estável
-- por (proposta, nome) — daí o índice comum, não único.
--
-- Migração ADITIVA e idempotente: acrescenta apenas o índice de leitura e
-- garante o guard de RLS. Nenhuma coluna nova, nenhum DDL destrutivo.
begin;

-- (proposta_id, disciplina_id) atende também as buscas só por proposta_id
-- (coluna à esquerda), então não há índice separado de proposta_id.
create index if not exists idx_sugestoes_proposta_disciplina
  on public.sugestoes (proposta_id, disciplina_id);

-- RLS no mesmo padrão auth_all das demais tabelas (0113/0114): aplicação
-- single-tenant, todo usuário autenticado é confiável. Idempotente — se a
-- tabela original já tiver RLS e a policy, ambos os comandos são no-op.
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
