import { createClient } from "@/lib/supabase/client"
import type { VersaoSnapshot } from "@/lib/document/tipos"

// Cria o próximo snapshot de forma atômica no banco. Documento e branding são
// gravados juntos para que uma versão antiga continue reproduzível no futuro.
export async function snapshotVersao(
  propostaId: string,
  snapshot: VersaoSnapshot,
  valorTotal: number,
  geradoPor: string | null,
): Promise<{ versao: number; snapshot: VersaoSnapshot }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("fn_snapshot_versao_proposta", {
    p_proposta_id: propostaId,
    p_snapshot: snapshot as any,
    p_valor_total: valorTotal,
    p_gerado_por: geradoPor,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("O banco não retornou a versão criada.")
  return {
    versao: Number(row.versao),
    snapshot: row.snapshot as VersaoSnapshot,
  }
}

export async function listarVersoes(propostaId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("versoes_proposta")
    .select("versao, valor_total, created_at")
    .eq("proposta_id", propostaId)
    .order("versao", { ascending: false })
  if (error) throw error
  return data ?? []
}

// Recupera o JSON bruto para aceitar tanto snapshots novos (doc + empresa)
// quanto o formato legado, que continha somente PropostaDoc.
export async function getVersaoSnapshot(
  propostaId: string,
  versao: number,
): Promise<unknown | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("versoes_proposta")
    .select("snapshot")
    .eq("proposta_id", propostaId)
    .eq("versao", versao)
    .maybeSingle()
  if (error) throw error
  return data?.snapshot ?? null
}
