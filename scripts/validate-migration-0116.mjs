// Valida a migration 0116: tabela sugestoes, colunas, índice único e RLS.
// Uso: node scripts/validate-migration-0116.mjs
import { getClient, loadEnv } from './lib-db.mjs'

const client = await getClient(loadEnv())
let ok = 0, fail = 0
const check = (nome, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  cond ? ok++ : fail++
}

const cols = await client.query(
  `select column_name from information_schema.columns
   where table_schema = 'public' and table_name = 'sugestoes'`,
)
const nomes = cols.rows.map((r) => r.column_name)
const esperadas = [
  'id', 'proposta_id', 'disciplina_id', 'disciplina_nome',
  'valor_unitario_sugerido', 'valor_total_sugerido', 'fatores_considerados',
  'justificativa', 'confianca', 'base_recente_qtd', 'base_antiga_qtd',
  'base_antiga', 'fonte', 'usuario_id', 'created_at',
]
for (const c of esperadas) check(`coluna ${c}`, nomes.includes(c))

const idx = await client.query(
  `select indexname from pg_indexes where schemaname = 'public' and tablename = 'sugestoes'`,
)
check('índice único (proposta, disciplina)', idx.rows.some((r) => r.indexname === 'uq_sugestoes_proposta_disciplina'))

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
