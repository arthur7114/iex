-- 0117_v_aderencia_ia.sql
-- Fase 3 (IA) — View de aderência do copiloto: junção (sugestão × item praticado)
-- feita NO BANCO, não no navegador (PRD 16.4).
--
-- POR QUE ESTA VIEW EXISTE
-- `getMetricasIA` lia as DUAS tabelas inteiras, sem filtro e sem limite, a cada
-- montagem do dashboard, e cruzava os arrays em JS. Isso tinha dois problemas:
--   1) VIÉS SILENCIOSO, hoje — o PostgREST aplica um teto de linhas
--      (`max-rows`, tipicamente 1000) em select sem range. `proposta_itens`
--      cresce mais rápido que `sugestoes` (todo item de toda proposta, com ou
--      sem IA) e seria truncada primeiro: a junção em JS deixaria de encontrar
--      itens que EXISTEM, descartaria sugestões válidas da amostra e a métrica
--      passaria a descrever um recorte arbitrário do banco — sem erro nenhum na
--      tela. Com a junção no banco, o teto passa a incidir sobre o resultado já
--      pareado (limitado ao nº de sugestões com item correspondente), e não
--      sobre dois conjuntos que precisam estar completos para se cruzarem.
--   2) BANDA — trafegar duas tabelas inteiras para o navegador calcular seis
--      percentuais.
--
-- A MATEMÁTICA NÃO VEM PARA O SQL. A tolerância de 2%, a variação média e os
-- demais percentuais continuam em `lib/copiloto/metricas.ts::computeMetricasIA`
-- (puro e testado), que segue sendo a única fonte da regra de negócio. Esta
-- migração move APENAS onde a junção acontece. Reimplementar a tolerância aqui
-- criaria duas cópias independentes da mesma regra, livres para divergir.
--
-- SEMÂNTICA DA JUNÇÃO (idêntica à que existia em lib/db/sugestoes.ts)
-- Casa `sugestoes` com `proposta_itens` dentro da MESMA proposta:
--   * preferência por `disciplina_id` (id é estável; a disciplina pode ser
--     renomeada ou desativada depois da sugestão registrada);
--   * fallback por `disciplina_nome` quando não há casamento por id — seja
--     porque `sugestoes.disciplina_id` é nulo (disciplina removida antes do
--     registro), seja porque o id não encontra par no item.
-- Um `left join ... on (proposta_id, disciplina_id)` NÃO expressa isso: ele não
-- tenta o nome quando o id falha. Daí o `cross join lateral ... limit 1`:
--   * o `order by` põe o casamento por id na frente (0) e o por nome atrás (1),
--     então o id sempre vence quando existe — é a regra "prefere id" escrita
--     explicitamente, não um efeito colateral da ordem das linhas;
--   * o `limit 1` garante NO MÁXIMO UM item por sugestão. Isso importa porque
--     nomes de disciplina PODEM se repetir na mesma proposta (ver 221cb66): sem
--     o limite, uma sugestão casada por nome com 3 itens homônimos entraria 3
--     vezes na amostra e distorceria os percentuais;
--   * `cross join` (e não `left join lateral`) descarta a sugestão sem item
--     correspondente — mesmo comportamento do `flatMap`/`return []` anterior:
--     sugestão sem valor praticado não é aderência nem desvio, é ausência de
--     dado, e não pode entrar no denominador.
-- Desempate entre itens igualmente elegíveis: `created_at desc, id desc`, só
-- para o resultado ser determinístico (a versão em JS dependia da ordem de
-- chegada das linhas, que o PostgREST não garante).
--
-- IDEMPOTÊNCIA: view não precisa de `if not exists`. `create or replace view` já
-- é idempotente por natureza — reaplicar substitui a definição pela mesma.
-- (Um `replace` só falha se mudar nome/tipo/ordem das colunas existentes; se
-- algum dia esta lista de colunas mudar, a migração seguinte precisará de um
-- `drop view` explícito antes.)
begin;

create or replace view public.v_aderencia_ia
-- security_invoker: a view roda com as permissões de quem consulta, então a RLS
-- de `sugestoes` e `proposta_itens` continua valendo. Sem isso, uma view em
-- Postgres roda como o dono (postgres) e viraria um bypass de RLS.
with (security_invoker = true) as
select
  s.disciplina_nome                                    as disciplina_nome,
  s.valor_total_sugerido                               as valor_sugerido_ia,
  i.valor_final                                        as valor_final,
  s.confianca                                          as confianca,
  -- Contagens de comparáveis, não flags. O booleano "base antiga" continua
  -- sendo derivado na leitura (base_recente = 0 e base_antiga > 0), como em
  -- resumirGrupo/analise.ts — a view não decide isso.
  s.base_recente                                       as base_recente,
  s.base_antiga                                        as base_antiga,
  -- Justificativa é do ITEM (o que o usuário escreveu ao praticar o valor),
  -- não da sugestão. Texto só de espaço não conta.
  (coalesce(btrim(i.justificativa), '') <> '')          as tem_justificativa,
  s.fonte                                              as fonte
from public.sugestoes s
cross join lateral (
  select it.valor_final, it.justificativa
  from public.proposta_itens it
  where it.proposta_id = s.proposta_id
    and (
      (s.disciplina_id is not null and it.disciplina_id = s.disciplina_id)
      -- `is not distinct from` e não `=`: nome nulo dos dois lados casava na
      -- versão em JS (as chaves viravam a string "null"). Na prática
      -- `registrarSugestoes` já descarta nome vazio, então é só paridade.
      or it.disciplina_nome is not distinct from s.disciplina_nome
    )
  order by
    case when s.disciplina_id is not null and it.disciplina_id = s.disciplina_id then 0 else 1 end,
    it.created_at desc,
    it.id desc
  limit 1
) i;

comment on view public.v_aderencia_ia is
  'Uma linha por (sugestão do copiloto × item praticado) já pareados no banco. '
  'Consumida por lib/db/sugestoes.ts::getMetricasIA, que só aplica a matemática '
  '(computeMetricasIA). Ver cabeçalho de 0117_v_aderencia_ia.sql.';

grant select on public.v_aderencia_ia to authenticated, service_role;

-- A view é objeto novo: sem o reload, o PostgREST só a enxergaria no próximo
-- restart do schema cache.
notify pgrst, 'reload schema';

insert into public._iex_migrations (name, applied_at)
select '0117_v_aderencia_ia.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0117_v_aderencia_ia.sql');

commit;
