import { createClient } from "@/lib/supabase/client"
import type { Documento } from "./types"
import { registrarLogSeguro } from "./logs"
import { getSignedUrl } from "@/lib/actions/uploads"

// Retorna uma URL temporária para download do arquivo do documento (bucket privado).
export async function urlDocumento(id: string): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.from("documentos").select("arquivo_path").eq("id", id).maybeSingle()
  if (!data?.arquivo_path) return null
  return getSignedUrl(data.arquivo_path)
}

interface DocumentoRow {
  id: string
  nome: string
  tipo: string | null
  disciplina_label: string | null
  status: string
  atualizado: string | null
  responsavel_nome: string | null
}

function toDocumento(r: DocumentoRow): Documento {
  return {
    id: r.id,
    nome: r.nome,
    tipo: r.tipo ?? "",
    disciplina: r.disciplina_label ?? "Geral",
    status: (r.status as Documento["status"]) ?? "Ativo",
    atualizado: r.atualizado ?? "",
    responsavel: r.responsavel_nome ?? "—",
  }
}

export async function listarDocumentos(): Promise<Documento[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("documentos")
    .select("id,nome,tipo,disciplina_label,status,atualizado,responsavel_nome")
    .is("excluido_em", null)
    .order("atualizado", { ascending: false })
  if (error) throw error
  return (data as DocumentoRow[]).map(toDocumento)
}

export async function criarDocumento(input: {
  nome: string
  tipo: string
  disciplina: string
  responsavelNome?: string
  arquivoPath?: string
  arquivoMime?: string
  arquivoTamanho?: number
}): Promise<Documento> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("documentos")
    .insert({
      nome: input.nome,
      tipo: input.tipo,
      disciplina_label: input.disciplina,
      responsavel_nome: input.responsavelNome ?? null,
      arquivo_path: input.arquivoPath ?? null,
      arquivo_mime: input.arquivoMime ?? null,
      arquivo_tamanho: input.arquivoTamanho ?? null,
      atualizado: new Date().toISOString().slice(0, 10),
    })
    .select("id,nome,tipo,disciplina_label,status,atualizado,responsavel_nome")
    .single()
  if (error) throw error
  await registrarLogSeguro("Documento adicionado", { entidade: input.nome, entidadeId: (data as DocumentoRow).id })
  return toDocumento(data as DocumentoRow)
}

export async function definirStatusDocumento(
  id: string,
  status: Documento["status"],
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("documentos")
    .update({ status, atualizado: new Date().toISOString().slice(0, 10) })
    .eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Documento — status alterado", { entidadeId: id, detalhe: status })
}

export async function excluirDocumento(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("documentos")
    .update({ excluido_em: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Documento excluído", { entidadeId: id })
}
