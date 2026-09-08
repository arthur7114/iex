-- 0118_perfil_cargo.sql
-- Cargo profissional do usuário (ex.: "Diretor Comercial", "Engenheira Civil").
--  * Distinto de `usuarios.funcao`, que é o papel de PERMISSÃO (Administrador/Editor)
--    consumido por exigirAdmin(). Misturar os dois fazia a assinatura da proposta
--    imprimir um cargo fixo no código para todo mundo.
--  * Sem backfill: cargo nulo mantém o fallback "Diretor Comercial" nos documentos,
--    preservando a saída atual das propostas já emitidas.
--  * O cargo usado em cada proposta fica congelado no snapshot da versão (jsonb),
--    não nesta coluna — alterar o cargo aqui não reescreve documentos emitidos.
--  Migração ADITIVA e idempotente (segue o estilo de 0105/0106/0112/0113/0114/0115).
begin;

alter table public.usuarios
  add column if not exists cargo text;

insert into public._iex_migrations (name, applied_at)
select '0118_perfil_cargo.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0118_perfil_cargo.sql');

commit;
