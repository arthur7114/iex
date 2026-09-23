"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { exigirSessao } from "./_auth"
import { enviarEmail, smtpConfigurado } from "@/lib/email/smtp"
import { baixarImagensInline, carregarContextoEnvio, urlPublicaBranding } from "@/lib/email/contexto"
import { montarAssinatura, montarCorpoEmail, resolverPrevia, srcInline } from "@/lib/email/assinatura"
import { modeloEfetivo, renderizarModelo, valoresDaProposta } from "@/lib/email/modelo"
import type { PropostaDoc } from "@/lib/document/tipos"

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

// Conteúdo inicial do compositor: modelo das Configurações renderizado com a
// proposta e com quem está logado, mais a prévia da assinatura (URLs públicas).
export async function prepararEmailProposta(
  doc: PropostaDoc,
): Promise<{ ok: true; assunto: string; corpo: string; assinaturaHtml: string } | { ok: false; error: string }> {
  const guard = await exigirSessao()
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = await carregarContextoEnvio(guard.user)
  const modelo = modeloEfetivo(ctx.modelo)
  const valores = valoresDaProposta(doc, ctx.marca, { nome: ctx.assinatura.nome, cargo: ctx.cargo })
  const assinatura = montarAssinatura(ctx.assinatura, ctx.marca, resolverPrevia(urlPublicaBranding))
  return {
    ok: true,
    assunto: renderizarModelo(modelo.assunto, valores),
    corpo: renderizarModelo(modelo.corpo, valores),
    assinaturaHtml: assinatura.html,
  }
}

// Envia a proposta por e-mail (SMTP). Se SMTP_USER/SMTP_PASS não estiverem configurados,
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
  const configurado = smtpConfigurado()

  // Assinatura de quem envia, sempre pela sessão.
  const ctx = await carregarContextoEnvio(guard.user)
  const assinatura = montarAssinatura(ctx.assinatura, ctx.marca, srcInline)
  const mensagem = montarCorpoEmail(input.corpo, assinatura)
  let falhasImagem: string[] = []

  const mime = input.anexoTipo === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

  const simulado = !configurado
  let providerId: string | undefined
  let erro: string | undefined

  if (configurado) {
    try {
      const inline = await baixarImagensInline(assinatura.imagens)
      falhasImagem = inline.falhas
      providerId = await enviarEmail({
        para: input.destinatario,
        copias: input.copias,
        assunto: input.assunto,
        texto: mensagem.texto,
        html: mensagem.html,
        replyTo: ctx.assinatura.email ?? undefined,
        anexos: [...inline.anexos, { nome: input.anexoNome, base64: input.anexoBase64, mime }],
      })
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
    detalhe:
      (erro ? `Falha: ${erro}` : simulado ? `Simulado para ${input.destinatario}` : `Enviado para ${input.destinatario}`) +
      (falhasImagem.length ? ` (sem imagem: ${falhasImagem.join(", ")})` : ""),
  })

  if (erro) return { ok: false, simulado: false, error: erro }
  return { ok: true, simulado, providerId }
}
