import { createClient } from "@/lib/supabase/client"
import type { Documento } from "./types"
import { registrarLogSeguro } from "./logs"
import { getSignedUrl } from "@/lib/actions/uploads"

// Documento com os metadados do arquivo (tamanho/formato/path), usados na
// listagem, no preview e na substituição de arquivo.
export interface DocumentoDetalhado extends Documento {
  arquivoPath: string | null
  arquivoMime: string | null
  arquivoTamanho: number | null
}

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
  arquivo_path: string | null
  arquivo_mime: string | null
  arquivo_tamanho: number | null
}

function toDocumento(r: DocumentoRow): DocumentoDetalhado {
  return {
    id: r.id,
    nome: r.nome,
    tipo: r.tipo ?? "",
    disciplina: r.disciplina_label ?? "Geral",
    status: (r.status as Documento["status"]) ?? "Ativo",
    atualizado: r.atualizado ?? "",
    responsavel: r.responsavel_nome ?? "—",
    arquivoPath: r.arquivo_path,
    arquivoMime: r.arquivo_mime,
    arquivoTamanho: r.arquivo_tamanho,
  }
}

const COLUNAS =
  "id,nome,tipo,disciplina_label,status,atualizado,responsavel_nome,arquivo_path,arquivo_mime,arquivo_tamanho"

export async function listarDocumentos(): Promise<DocumentoDetalhado[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("documentos")
    .select(COLUNAS)
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
}): Promise<DocumentoDetalhado> {
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
    .select(COLUNAS)
    .single()
  if (error) throw error
  await registrarLogSeguro("Documento adicionado", { entidade: input.nome, entidadeId: (data as DocumentoRow).id })
  return toDocumento(data as DocumentoRow)
}

// Edita metadados do documento (nome, tipo, disciplina).
export async function atualizarDocumento(
  id: string,
  input: { nome: string; tipo: string; disciplina: string },
): Promise<DocumentoDetalhado> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("documentos")
    .update({
      nome: input.nome,
      tipo: input.tipo,
      disciplina_label: input.disciplina,
      atualizado: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id)
    .select(COLUNAS)
    .single()
  if (error) throw error
  await registrarLogSeguro("Documento editado", { entidade: input.nome, entidadeId: id })
  return toDocumento(data as DocumentoRow)
}

// Substitui o arquivo armazenado (novo path/mime/tamanho já enviados via upload).
export async function substituirArquivoDocumento(
  id: string,
  arquivo: { path: string; mime: string; tamanho: number },
): Promise<DocumentoDetalhado> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("documentos")
    .update({
      arquivo_path: arquivo.path,
      arquivo_mime: arquivo.mime,
      arquivo_tamanho: arquivo.tamanho,
      atualizado: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id)
    .select(COLUNAS)
    .single()
  if (error) throw error
  await registrarLogSeguro("Documento — arquivo substituído", { entidadeId: id })
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
