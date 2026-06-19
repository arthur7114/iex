"use server"

import { createAdminClient } from "@/lib/supabase/admin"

function sanitizar(nome: string) {
  return nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.\-_]/g, "-")
}

// Faz upload de um arquivo (via FormData) para um bucket. Retorna o path salvo.
export async function uploadArquivo(
  bucket: "branding" | "kb",
  prefixo: string,
  formData: FormData,
): Promise<{ path: string; error?: string }> {
  const file = formData.get("file") as File | null
  if (!file) return { path: "", error: "Arquivo ausente" }
  const admin = createAdminClient()
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin"
  const path = `${prefixo}/${Date.now()}-${sanitizar(file.name).slice(0, 40)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  })
  if (error) return { path: "", error: error.message }
  return { path }
}

// Gera URL assinada (download) para arquivos do bucket privado kb.
export async function getSignedUrl(path: string, expiraSegundos = 300): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.storage.from("kb").createSignedUrl(path, expiraSegundos)
  return data?.signedUrl ?? null
}
