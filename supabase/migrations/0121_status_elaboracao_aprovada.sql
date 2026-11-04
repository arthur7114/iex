-- 0121_status_elaboracao_aprovada.sql
-- fn_transicionar_status passa a aceitar "Em elaboração" -> "Aprovada".
-- Motivo: proposta fechada fora da plataforma (WhatsApp, e-mail) nunca passa por
-- "Enviada"; o usuário não conseguia marcá-la como aprovada ("Transição inválida").
-- Única mudança em relação à versão anterior: a linha marcada com [0121] no CASE.
-- Idempotente: CREATE OR REPLACE.
begin;

create or replace function public.fn_transicionar_status(
  p_proposta_id uuid,
  p_novo_status text,
  p_motivo_id uuid default null,
  p_detalhe text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_atual text;
  v_numero text;
  v_uid uuid;
  v_nome text;
  v_permitido boolean;
  v_motivo_nome text;
begin
  select status, numero into v_atual, v_numero from public.propostas where id = p_proposta_id;
  if v_atual is null then
    raise exception 'Proposta não encontrada';
  end if;

  v_permitido := case
    when v_atual = p_novo_status then true
    when v_atual = 'Em elaboração' and p_novo_status in ('Enviada', 'Aprovada', 'Perdida') then true -- [0121] + 'Aprovada'
    when v_atual = 'Enviada' and p_novo_status in ('Aprovada', 'Perdida', 'Em elaboração') then true
    when v_atual = 'Aprovada' and p_novo_status = 'Em elaboração' then true
    when v_atual = 'Perdida' and p_novo_status = 'Em elaboração' then true
    else false
  end;
  if not v_permitido then
    raise exception 'Transição inválida: % -> %', v_atual, p_novo_status;
  end if;

  if p_novo_status = 'Perdida' and p_motivo_id is null then
    raise exception 'Motivo de perda é obrigatório';
  end if;

  select id, nome into v_uid, v_nome from public.usuarios where auth_user_id = auth.uid();

  if p_motivo_id is not null then
    select nome into v_motivo_nome from public.motivos_perda where id = p_motivo_id;
  end if;

  update public.propostas
  set status = p_novo_status,
      motivo_perda_id = case when p_novo_status = 'Perdida' then p_motivo_id else null end,
      data_envio = case when p_novo_status = 'Enviada' and data_envio is null then current_date else data_envio end,
      data_fechamento = case when p_novo_status in ('Aprovada', 'Perdida') then current_date else null end
  where id = p_proposta_id;

  insert into public.proposta_eventos (proposta_id, data, usuario_id, usuario_nome, acao)
  values (
    p_proposta_id, current_date, v_uid, v_nome,
    'Status alterado para ' || p_novo_status
      || case when p_novo_status = 'Perdida' and v_motivo_nome is not null then ' — ' || v_motivo_nome else '' end
  );

  insert into public.logs_uso (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe)
  values (
    v_uid, v_nome, 'Mudança de status', v_numero, p_proposta_id::text,
    coalesce(p_detalhe, v_atual || ' → ' || p_novo_status
      || case when v_motivo_nome is not null then ' (' || v_motivo_nome || ')' else '' end)
  );
end;
$function$;

insert into public._iex_migrations (name, applied_at)
select '0121_status_elaboracao_aprovada.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0121_status_elaboracao_aprovada.sql');

commit;
