"use server"

import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"
import { exigirSessao } from "./_auth"

export interface EnviarPropostaInput {
  propostaId: string
  destinatario: string
  copias?: string[]
  assunto: string
  corpo: string
  anexoTipo: "pdf" | "word"
  anexoNome: string
  anexoBase64: string // conteúdo do anexo (base64, sem prefixo data:)
  usuarioId?: string | null
  usuarioNome?: string | null
}

// Envia a proposta por e-mail (Resend). Se RESEND_API_KEY não estiver configurada,
// registra o envio como "simulado" para não bloquear a apresentação/beta.
export async function enviarProposta(
  input: EnviarPropostaInput,
): Promise<{ ok: boolean; simulado: boolean; providerId?: string; error?: string }> {
  const guard = await exigirSessao()
  if (!guard.ok) return { ok: false, simulado: false, error: guard.error }
  // A autoria vem da sessão — nunca do cliente — para não permitir spoofing do log.
  const usuarioId = guard.user.usuarioId
  const usuarioNome = guard.user.nome
  const admin = createAdminClient()
  const apiKey = process.env.RESEND_API_KEY
  const remetente = process.env.EMAIL_FROM || "IEX Propostas <onboarding@resend.dev>"

  const mime = input.anexoTipo === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

  let simulado = !apiKey
  let providerId: string | undefined
  let erro: string | undefined

  if (apiKey) {
    try {
      const resend = new Resend(apiKey)
      const { data, error } = await resend.emails.send({
        from: remetente,
        to: [input.destinatario],
        cc: input.copias?.length ? input.copias : undefined,
        subject: input.assunto,
        text: input.corpo,
        attachments: [{ filename: input.anexoNome, content: input.anexoBase64 }],
      })
      if (error) { erro = (error as any).message ?? String(error); simulado = false }
      else providerId = data?.id
    } catch (e) {
      erro = (e as Error).message
    }
  }

  // Registra o envio (envios_email) independentemente do provedor.
  await admin.from("envios_email").insert({
    proposta_id: input.propostaId,
    destinatario: input.destinatario,
    copias: input.copias?.join(", ") || null,
    assunto: input.assunto,
    corpo: input.corpo,
    anexo_tipo: input.anexoTipo,
    provider_id: providerId ?? null,
    status: erro ? "falha" : simulado ? "simulado" : "enviado",
    enviado_por: usuarioId,
    enviado_em: erro ? null : new Date().toISOString(),
  })

  // Auditoria
  await admin.from("logs_uso").insert({
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
    acao: "Envio de e-mail",
    entidade: "Proposta",
    entidade_id: input.propostaId,
    detalhe: erro ? `Falha: ${erro}` : simulado ? `Simulado para ${input.destinatario}` : `Enviado para ${input.destinatario}`,
  })

  if (erro) return { ok: false, simulado: false, error: erro }
  return { ok: true, simulado, providerId }
}
