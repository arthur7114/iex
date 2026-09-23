"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { exigirSessao } from "./_auth"
import { montarAssinatura, resolverPrevia, type ModoAssinatura } from "@/lib/email/assinatura"
import { carregarContextoEnvio, urlPublicaBranding } from "@/lib/email/contexto"

// Assinatura de e-mail do PRÓPRIO usuário. Mesma regra de atualizarMeuPerfil:
// escreve com service-role, sempre filtrando pelo auth_user_id da sessão.

export interface MinhaAssinatura {
  modo: ModoAssinatura
  telefone: string
  email: string // vazio = usa o e-mail do login
  emailLogin: string
  fotoPath: string | null
  fotoUrl: string | null
  imagemPath: string | null
  imagemUrl: string | null
}

const TIPOS_IMAGEM = ["image/png", "image/jpeg"]
const MAX_BYTES = 500 * 1024

const schema = z.object({
  modo: z.enum(["html", "imagem"]),
  telefone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]),
  fotoPath: z.string().nullable(),
  imagemPath: z.string().nullable(),
})

export async function obterMinhaAssinatura(): Promise<MinhaAssinatura | null> {
  const guard = await exigirSessao()
  if (!guard.ok) return null
  const { data } = await createAdminClient()
    .from("usuarios")
    .select("assinatura_modo,assinatura_telefone,assinatura_email,assinatura_foto_path,assinatura_imagem_path")
    .eq("auth_user_id", guard.user.authUserId)
    .maybeSingle()
  const fotoPath = (data?.assinatura_foto_path as string | null) ?? null
  const imagemPath = (data?.assinatura_imagem_path as string | null) ?? null
  return {
    modo: (data?.assinatura_modo as ModoAssinatura | null) ?? "html",
    telefone: (data?.assinatura_telefone as string | null) ?? "",
    email: (data?.assinatura_email as string | null) ?? "",
    emailLogin: guard.user.email ?? "",
    fotoPath,
    fotoUrl: fotoPath ? urlPublicaBranding(fotoPath) : null,
    imagemPath,
    imagemUrl: imagemPath ? urlPublicaBranding(imagemPath) : null,
  }
}

export async function salvarMinhaAssinatura(input: {
  modo: ModoAssinatura
  telefone: string
  email: string
  fotoPath: string | null
  imagemPath: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirSessao()
  if (!guard.ok) return { ok: false, error: guard.error }
  const v = schema.safeParse(input)
  if (!v.success) return { ok: false, error: "Confira o telefone e o e-mail da assinatura." }

  // Só aceita imagens da pasta do próprio usuário: impede apontar para arquivo alheio.
  const pasta = `assinaturas/${guard.user.usuarioId}/`
  for (const p of [v.data.fotoPath, v.data.imagemPath]) {
    if (p && (!p.startsWith(pasta) || p.includes(".."))) return { ok: false, error: "Imagem inválida." }
  }

  const { error } = await createAdminClient()
    .from("usuarios")
    .update({
      assinatura_modo: v.data.modo,
      assinatura_telefone: v.data.telefone || null,
      assinatura_email: v.data.email || null,
      assinatura_foto_path: v.data.fotoPath,
      assinatura_imagem_path: v.data.imagemPath,
    })
    .eq("auth_user_id", guard.user.authUserId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function uploadImagemAssinatura(
  tipo: "foto" | "imagem",
  formData: FormData,
): Promise<{ ok: true; path: string; url: string } | { ok: false; error: string }> {
  const guard = await exigirSessao()
  if (!guard.ok) return { ok: false, error: guard.error }
  const file = formData.get("file") as File | null
  if (!file) return { ok: false, error: "Arquivo ausente." }
  if (!TIPOS_IMAGEM.includes(file.type)) return { ok: false, error: "Use uma imagem PNG ou JPG." }
  if (file.size > MAX_BYTES) return { ok: false, error: "A imagem deve ter até 500 KB." }

  const ext = file.type === "image/png" ? "png" : "jpg"
  const path = `assinaturas/${guard.user.usuarioId}/${tipo}-${Date.now()}.${ext}`
  const { error } = await createAdminClient()
    .storage.from("branding")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, path, url: urlPublicaBranding(path) }
}

// Prévia da assinatura de quem está logado (Configurações › E-mail).
export async function previaMinhaAssinatura(): Promise<string> {
  const guard = await exigirSessao()
  if (!guard.ok) return ""
  const ctx = await carregarContextoEnvio(guard.user)
  return montarAssinatura(ctx.assinatura, ctx.marca, resolverPrevia(urlPublicaBranding)).html
}
