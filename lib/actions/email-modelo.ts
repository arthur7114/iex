"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { exigirAdmin, exigirSessao } from "./_auth"
import { LIMITE_ASSUNTO, LIMITE_CORPO } from "@/lib/email/modelo"

// Modelo padrão do e-mail de proposta (Configurações › E-mail). String vazia
// significa "usar o texto padrão" — gravado como nulo.
export interface ModeloEmail {
  assunto: string
  corpo: string
}

const schema = z.object({
  assunto: z.string().max(LIMITE_ASSUNTO),
  corpo: z.string().max(LIMITE_CORPO),
})

export async function obterModeloEmail(): Promise<ModeloEmail> {
  const guard = await exigirSessao()
  if (!guard.ok) return { assunto: "", corpo: "" }
  const { data } = await createAdminClient()
    .from("config_empresa")
    .select("email_assunto_modelo,email_corpo_modelo")
    .eq("id", 1)
    .maybeSingle()
  return {
    assunto: (data?.email_assunto_modelo as string | null) ?? "",
    corpo: (data?.email_corpo_modelo as string | null) ?? "",
  }
}

export async function salvarModeloEmail(input: ModeloEmail): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const v = schema.safeParse(input)
  if (!v.success) {
    return { ok: false, error: `O assunto aceita até ${LIMITE_ASSUNTO} caracteres e o corpo até ${LIMITE_CORPO}.` }
  }
  const admin = createAdminClient()
  const { error } = await admin.from("config_empresa").upsert(
    {
      id: 1,
      email_assunto_modelo: v.data.assunto.trim() || null,
      email_corpo_modelo: v.data.corpo.trim() ? v.data.corpo : null,
    },
    { onConflict: "id" },
  )
  if (error) return { ok: false, error: error.message }
  await admin.from("logs_uso").insert({
    usuario_id: guard.user.usuarioId,
    usuario_nome: guard.user.nome,
    acao: "Modelo de e-mail atualizado",
    entidade: "Configurações",
  })
  return { ok: true }
}
