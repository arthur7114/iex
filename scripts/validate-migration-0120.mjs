// Confere a migration 0120 (listas de Incluso / Não incluso da IEX no
// "Modelo padrão IEX"). Mostra se o modelo ficou com a lista nova ou se a IEX
// já tinha editado a lista em Cadastros (nesse caso a 0120 não mexe).
// Uso: node scripts/validate-migration-0120.mjs
import { getClient, loadEnv } from './lib-db.mjs'

const client = await getClient(loadEnv())
let ok = 0, fail = 0
const check = (nome, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  cond ? ok++ : fail++
}

const modelo = await client.query(
  `select premissas, exclusoes from public.modelos_proposta where nome = 'Modelo padrão IEX'`,
)
check('Modelo padrão IEX existe', modelo.rowCount >= 1)
for (const m of modelo.rows) {
  const premissas = (m.premissas ?? '').split('\n')
  const exclusoes = (m.exclusoes ?? '').split('\n')
  const premissaNova = premissas[0]?.startsWith('Projeto executivo detalhado em REVIT')
  const exclusaoNova = exclusoes[0]?.startsWith('Relatório de estudo do solo')
  console.log(`  premissas: ${premissaNova ? 'lista da IEX' : 'editada em Cadastros (mantida)'} (${premissas.length} itens)`)
  console.log(`  exclusões: ${exclusaoNova ? 'lista da IEX' : 'editada em Cadastros (mantida)'} (${exclusoes.length} itens)`)
}

const reg = await client.query(
  `select 1 from public._iex_migrations where name = '0120_listas_incluso_iex.sql'`,
)
check('registro em _iex_migrations', reg.rowCount === 1)

await client.end()
console.log(`\n${ok} ok, ${fail} falha(s)`)
process.exit(fail ? 1 : 0)
