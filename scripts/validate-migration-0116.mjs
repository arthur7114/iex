// Valida o estado de public.sugestoes esperado pelo copiloto.
//
// A tabela NÃO é criada pela migration 0116: ela é anterior às migrations
// versionadas deste repo (ver supabase/migrations/0116_sugestoes_ia.sql). A
// 0116 só acrescenta o índice (proposta_id, disciplina_id) e o guard de RLS.
// Por isso as colunas abaixo são as do schema REAL — se este script falhar em
// alguma delas, o problema é o código da aplicação divergindo do banco, não uma
// migração faltando.
// Uso: node scripts/validate-migration-0116.mjs
import { getClient, loadEnv } from './lib-db.mjs'

const client = await getClient(loadEnv())
let ok = 0, fail = 0
const check = (nome, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  cond ? ok++ : fail++
}

const cols = await client.query(
  `select column_name, data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'sugestoes'`,
)
const tipos = new Map(cols.rows.map((r) => [r.column_name, r.data_type]))
const esperadas = [
  'id', 'proposta_id', 'disciplina_id', 'disciplina_nome', 'fonte',
  'valor_unitario_sugerido', 'valor_total_sugerido', 'multiplicador',
  'confianca', 'base_recente', 'base_antiga', 'fatores', 'entrada',
  'explicacao', 'modelo', 'created_at',
]
for (const c of esperadas) check(`coluna ${c}`, tipos.has(c))

// Colunas do plano original que NÃO existem: se alguma aparecer, alguém
// recriou a tabela e o mapeamento do código precisa ser revisto.
for (const c of ['fatores_considerados', 'justificativa', 'base_recente_qtd', 'base_antiga_qtd', 'usuario_id']) {
  check(`coluna ${c} ausente (esperado)`, !tipos.has(c))
}

// Tipos que o código depende: disciplina_id é TEXT (ids como
// 'climatizacao-splits-vrf') e base_recente/base_antiga são CONTAGENS inteiras,
// não booleanos — o booleano "base antiga" é derivado na leitura.
check('disciplina_id é text', tipos.get('disciplina_id') === 'text', tipos.get('disciplina_id'))
check('base_recente é integer', tipos.get('base_recente') === 'integer', tipos.get('base_recente'))
check('base_antiga é integer', tipos.get('base_antiga') === 'integer', tipos.get('base_antiga'))
check('fatores é jsonb', tipos.get('fatores') === 'jsonb', tipos.get('fatores'))
check('entrada é jsonb', tipos.get('entrada') === 'jsonb', tipos.get('entrada'))

const idx = await client.query(
  `select indexname from pg_indexes where schemaname = 'public' and tablename = 'sugestoes'`,
)
check('índice (proposta, disciplina)', idx.rows.some((r) => r.indexname === 'idx_sugestoes_proposta_disciplina'))

const rls = await client.query(
  `select relrowsecurity from pg_class where oid = 'public.sugestoes'::regclass`,
)
check('RLS habilitado', rls.rows[0]?.relrowsecurity === true)

const pol = await client.query(
  `select policyname from pg_policies where schemaname = 'public' and tablename = 'sugestoes'`,
)
check('policy auth_all', pol.rows.some((r) => r.policyname === 'auth_all'))

const mig = await client.query(
  `select 1 from public._iex_migrations where name = '0116_sugestoes_ia.sql'`,
)
check('registrada em _iex_migrations', mig.rowCount === 1)

await client.end()
console.log(`\n${ok} ok, ${fail} falhas`)
process.exit(fail ? 1 : 0)
