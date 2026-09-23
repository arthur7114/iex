import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { UsuarioSessao } from "@/lib/actions/_auth"
import type { DadosAssinatura, ImagemAssinatura, MarcaEmpresa, ModoAssinatura } from "./assinatura"

// Tudo o que o envio precisa além do que o cliente manda: modelo, marca e a
// assinatura de QUEM ENVIA — resolvida pela sessão, nunca pelo cliente.

export interface ContextoEnvio {
  modelo: { assunto: string | null; corpo: string | null }
  marca: MarcaEmpresa
  assinatura: DadosAssinatura
  cargo: string | null
}

export function urlPublicaBranding(path: string): string {
  return createAdminClient().storage.from("branding").getPublicUrl(path).data.publicUrl
}

// Não lança: sem banco, o envio segue com o texto padrão e a assinatura mínima.
export async function carregarContextoEnvio(usuario: UsuarioSessao): Promise<ContextoEnvio> {
  try {
    return await lerContexto(usuario)
  } catch {
    return {
      modelo: { assunto: null, corpo: null },
      marca: { razaoSocial: "", logoPath: null, corPrimaria: null },
      assinatura: {
        modo: null,
        nome: usuario.nome,
        cargo: null,
        telefone: null,
        email: usuario.email,
        fotoPath: null,
        imagemPath: null,
      },
      cargo: null,
    }
  }
}

async function lerContexto(usuario: UsuarioSessao): Promise<ContextoEnvio> {
  const admin = createAdminClient()
  const [{ data: empresa }, { data: perfil }] = await Promise.all([
    admin
      .from("config_empresa")
      .select("razao_social,logo_path,cor_primaria,email_assunto_modelo,email_corpo_modelo")
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("usuarios")
      .select(
        "nome,cargo,email,assinatura_modo,assinatura_telefone,assinatura_email,assinatura_foto_path,assinatura_imagem_path",
      )
      .eq("auth_user_id", usuario.authUserId)
      .maybeSingle(),
  ])

  const cargo = (perfil?.cargo as string | null) ?? null
  return {
    modelo: {
      assunto: (empresa?.email_assunto_modelo as string | null) ?? null,
      corpo: (empresa?.email_corpo_modelo as string | null) ?? null,
    },
    marca: {
      razaoSocial: (empresa?.razao_social as string | null) ?? "",
      logoPath: (empresa?.logo_path as string | null) ?? null,
      corPrimaria: (empresa?.cor_primaria as string | null) ?? null,
    },
    assinatura: {
      modo: (perfil?.assinatura_modo as ModoAssinatura | null) ?? null,
      nome: (perfil?.nome as string | null) ?? usuario.nome,
      cargo,
      telefone: (perfil?.assinatura_telefone as string | null) ?? null,
      email: (perfil?.assinatura_email as string | null) || (perfil?.email as string | null) || usuario.email,
      fotoPath: (perfil?.assinatura_foto_path as string | null) ?? null,
      imagemPath: (perfil?.assinatura_imagem_path as string | null) ?? null,
    },
    cargo,
  }
}

// Baixa as imagens da assinatura para anexar inline. Falha individual não
// bloqueia o envio: a imagem é omitida e reportada em `falhas`.
export async function baixarImagensInline(
  imgs: ImagemAssinatura[],
): Promise<{ anexos: { nome: string; base64: string; mime: string; cid: string }[]; falhas: string[] }> {
  const anexos: { nome: string; base64: string; mime: string; cid: string }[] = []
  const falhas: string[] = []
  if (!imgs.length) return { anexos, falhas }
  const admin = createAdminClient()
  for (const img of imgs) {
    try {
      const { data, error } = await admin.storage.from("branding").download(img.path)
      if (error || !data) throw error ?? new Error("vazio")
      const ext = img.path.split(".").pop()?.toLowerCase() ?? "png"
      anexos.push({
        nome: `${img.cid}.${ext}`,
        base64: Buffer.from(await data.arrayBuffer()).toString("base64"),
        mime: data.type || (ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png"),
        cid: img.cid,
      })
    } catch {
      falhas.push(img.cid)
    }
  }
  return { anexos, falhas }
}
