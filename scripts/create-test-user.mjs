// Cria (ou atualiza) um usuário de teste via Admin API (service role).
// Uso: node scripts/create-test-user.mjs
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = {}
for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].trim()
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = process.env.TEST_EMAIL || "teste.iex@iexprojetos.com"
const PASSWORD = process.env.TEST_PASSWORD || "IexBeta!2026"
const NOME = "Usuário de Teste"

// Já existe?
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
const existing = list?.users?.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase())

if (existing) {
  await admin.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true })
  console.log(`Atualizado: ${EMAIL} (senha redefinida)`)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nome: NOME },
  })
  if (error) {
    console.error("ERRO:", error.message)
    process.exitCode = 1
  } else {
    console.log(`Criado: ${EMAIL} (id ${data.user.id})`)
  }
}
console.log(`\nCredenciais de teste:\n  e-mail: ${EMAIL}\n  senha:  ${PASSWORD}`)
