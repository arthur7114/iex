import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
const __dirname = dirname(fileURLToPath(import.meta.url))
const env = {}
for (const l of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].trim()
}
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let ok = 0, fail = 0
const check = (name, cond, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); cond ? ok++ : fail++ }

// 1) RLS: anônimo NÃO deve ler propostas
{
  const { data, error } = await anon.from("propostas").select("id").limit(1)
  check("RLS bloqueia anon em propostas", (data?.length ?? 0) === 0, error ? error.message : `rows=${data?.length}`)
}

// 2) Query exata de listarPropostas (embeds)
{
  const { data, error } = await svc.from("propostas")
    .select("*, proposta_itens(*), proposta_eventos(*), motivos_perda(nome)")
    .eq("arquivada", false).order("data_criacao", { ascending: false })
  const p0 = data?.[0]
  check("propostas + embeds", !error && Array.isArray(data) && data.length > 0, error?.message)
  check("  proposta tem itens[]", Array.isArray(p0?.proposta_itens) && p0.proposta_itens.length > 0)
  check("  proposta tem eventos[]", Array.isArray(p0?.proposta_eventos))
}

// 3) clientes_metricas
{
  const { data, error } = await svc.from("clientes_metricas").select("*").limit(3)
  check("clientes_metricas", !error && (data?.length ?? 0) > 0, error?.message)
  check("  tem propostas_enviadas/valor_aprovado", data?.[0] && "propostas_enviadas" in data[0] && "valor_aprovado" in data[0])
}

// 4) v_logs_uso (data/hora derivados)
{
  const { data, error } = await svc.from("v_logs_uso").select("id,usuario_nome,acao,data,hora").limit(2)
  check("v_logs_uso", !error, error?.message)
}

// 5) lookups + disciplinas + variaveis
for (const t of ["origens_cliente", "perfis_cliente", "tipos_empreendimento", "motivos_perda", "formas_pagamento", "disciplinas", "variaveis_complexidade"]) {
  const { data, error } = await svc.from(t).select("*").limit(1)
  check(`tabela ${t}`, !error && (data?.length ?? 0) > 0, error?.message)
}

// 6) configs
for (const t of ["config_empresa", "config_precificacao"]) {
  const { data, error } = await svc.from(t).select("*").eq("id", 1).maybeSingle()
  check(`config ${t}`, !error && !!data, error?.message)
}

console.log(`\nResultado: ${ok} ok, ${fail} falhas`)
process.exitCode = fail ? 1 : 0
