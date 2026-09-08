// Valida a view public.v_aderencia_ia criada pela migration 0117.
//
// A view existe para que a junção (sugestão × item praticado) aconteça no
// banco, e não no navegador: ver o cabeçalho de
// supabase/migrations/0117_v_aderencia_ia.sql. As colunas conferidas abaixo são
// exatamente as que lib/db/sugestoes.ts::getMetricasIA mapeia para
// LinhaAderencia — renomear qualquer uma quebra a métrica em silêncio (a
// leitura é tolerante a falha por design e degrada para métricas zeradas).
// Uso: node scripts/validate-migration-0117.mjs
import { getClient, loadEnv } from './lib-db.mjs'

const client = await getClient(loadEnv())
let ok = 0, fail = 0
const check = (nome, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  cond ? ok++ : fail++
}

const view = await client.query(
  `select table_name from information_schema.views
   where table_schema = 'public' and table_name = 'v_aderencia_ia'`,
)
check('view v_aderencia_ia existe', view.rowCount === 1)

const cols = await client.query(
  `select column_name, data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'v_aderencia_ia'`,
)
const tipos = new Map(cols.rows.map((r) => [r.column_name, r.data_type]))
const esperadas = [
  'disciplina_nome', 'valor_sugerido_ia', 'valor_final', 'confianca',
  'base_recente', 'base_antiga', 'tem_justificativa', 'fonte',
]
for (const c of esperadas) check(`coluna ${c}`, tipos.has(c))
check('sem colunas extras', tipos.size === esperadas.length, `${tipos.size} colunas`)

// tem_justificativa já vem resolvido como booleano pela view; base_recente e
// base_antiga continuam sendo CONTAGENS (o booleano "base antiga" é derivado no
// TypeScript, mesma regra de resumirGrupo em analise.ts).
check('tem_justificativa é boolean', tipos.get('tem_justificativa') === 'boolean', tipos.get('tem_justificativa'))
check('base_recente é integer', tipos.get('base_recente') === 'integer', tipos.get('base_recente'))
check('base_antiga é integer', tipos.get('base_antiga') === 'integer', tipos.get('base_antiga'))

// security_invoker: sem isso a view rodaria como o dono e ignoraria a RLS de
// sugestoes/proposta_itens.
const opts = await client.query(
  `select reloptions from pg_class where oid = 'public.v_aderencia_ia'::regclass`,
)
check(
  'security_invoker = true',
  (opts.rows[0]?.reloptions ?? []).some((o) => o.replace(/\s/g, '').toLowerCase() === 'security_invoker=true'),
  String(opts.rows[0]?.reloptions ?? []),
)

const grants = await client.query(
  `select grantee from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'v_aderencia_ia' and privilege_type = 'SELECT'`,
)
check('select para authenticated', grants.rows.some((r) => r.grantee === 'authenticated'))

// A view precisa ser consultável de fato (não só existir no catálogo). Se o
// select falhar, isso deve contar como falha da checagem, não derrubar o script.
try {
  const amostra = await client.query('select * from public.v_aderencia_ia limit 5')
  check('view consultável', true, `${amostra.rowCount} linha(s) na amostra`)
} catch (e) {
  check('view consultável', false, e.message)
}

const mig = await client.query(
  `select 1 from public._iex_migrations where name = '0117_v_aderencia_ia.sql'`,
)
check('registrada em _iex_migrations', mig.rowCount === 1)

await client.end()
console.log(`\n${ok} ok, ${fail} falhas`)
process.exit(fail ? 1 : 0)
