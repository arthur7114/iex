// Conexão direta ao Postgres do Supabase via session pooler (IPv4).
// O host direto db.<ref>.supabase.co é IPv6-only e não resolve em todo ambiente,
// então detectamos a região do pooler automaticamente.
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].trim()
    }
  } catch {}
  return { ...env, ...process.env }
}

const REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'sa-east-1', 'ca-central-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-south-1',
  'ap-northeast-1', 'ap-northeast-2',
]

function candidates(ref) {
  const hosts = []
  for (const p of ['aws-0', 'aws-1']) {
    for (const r of REGIONS) hosts.push(`${p}-${r}.pooler.supabase.com`)
  }
  return hosts.map((host) => ({
    host,
    port: 5432, // session pooler: suporta DDL e múltiplas instruções
    user: `postgres.${ref}`,
    database: 'postgres',
  }))
}

let CACHED = null

// Tenta conectar em cada região candidata até uma autenticar.
export async function getClient(env = loadEnv()) {
  const ref = env.SUPABASE_PROJECT_REF
  const password = env.SUPABASE_DB_PASSWORD
  if (!ref || !password) throw new Error('SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD ausentes no .env.local')

  const list = CACHED ? [CACHED] : candidates(ref)
  let lastErr
  for (const cfg of list) {
    const client = new pg.Client({
      ...cfg,
      password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
      query_timeout: 120000,
      statement_timeout: 120000,
    })
    try {
      await client.connect()
      await client.query('select 1')
      if (!CACHED) {
        CACHED = cfg
        console.log(`✓ Conectado via ${cfg.host}:${cfg.port}`)
      }
      return client
    } catch (e) {
      lastErr = e
      try { await client.end() } catch {}
      // ENOTFOUND/ETIMEDOUT/auth → tenta próxima região
    }
  }
  throw new Error(`Falha ao conectar ao banco. Último erro: ${lastErr?.message || lastErr}`)
}
