// Cria os buckets de Storage (idempotente). Uploads/downloads são feitos por
// server actions com service role, então não dependemos de policies de storage.
//   - branding: público (logo/assinatura embutidos no documento)
//   - kb: privado (documentos da base de conhecimento; download por signed URL)
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path"
const __dirname = dirname(fileURLToPath(import.meta.url))
const env = {}; for (const l of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].trim() }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const buckets = [
  { id: "branding", public: true, fileSizeLimit: 5 * 1024 * 1024 },
  { id: "kb", public: false, fileSizeLimit: 50 * 1024 * 1024 },
]
for (const b of buckets) {
  const { error } = await admin.storage.createBucket(b.id, { public: b.public, fileSizeLimit: b.fileSizeLimit })
  if (error && !/already exists/i.test(error.message)) {
    console.error(`✗ ${b.id}:`, error.message)
  } else {
    console.log(`✓ bucket ${b.id} (${b.public ? "público" : "privado"})`)
  }
}
