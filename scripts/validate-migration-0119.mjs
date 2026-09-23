// Valida as colunas criadas pela migration 0119 (modelo de e-mail + assinatura).
// Os nomes conferidos são os que lib/email/contexto.ts e as actions leem.
// Uso: node scripts/validate-migration-0119.mjs
import { getClient, loadEnv } from './lib-db.mjs'

const client = await getClient(loadEnv())
let ok = 0, fail = 0
const check = (nome, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  cond ? ok++ : fail++
}

const colunas = async (tabela) => {
  const r = await client.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [tabela],
  )
  return new Set(r.rows.map((x) => x.column_name))
}

const empresa = await colunas('config_empresa')
for (const c of ['email_assunto_modelo', 'email_corpo_modelo']) check(`config_empresa.${c}`, empresa.has(c))

const usuarios = await colunas('usuarios')
for (const c of [
  'assinatura_modo',
  'assinatura_telefone',
  'assinatura_email',
  'assinatura_foto_path',
  'assinatura_imagem_path',
]) check(`usuarios.${c}`, usuarios.has(c))

const chk = await client.query(
  `select 1 from pg_constraint where conname = 'usuarios_assinatura_modo_check'`,
)
check('check usuarios_assinatura_modo_check', chk.rowCount === 1)

const reg = await client.query(
  `select 1 from public._iex_migrations where name = '0119_email_modelo_assinatura.sql'`,
)
check('registro em _iex_migrations', reg.rowCount === 1)

await client.end()
console.log(`\n${ok} ok, ${fail} falha(s)`)
process.exit(fail ? 1 : 0)
