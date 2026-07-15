import { createClient } from "@/lib/supabase/client"
import type { PropostaDoc } from "@/lib/document/tipos"

// Cria um snapshot versionado da proposta (PRD 14 — versões da proposta).
export async function snapshotVersao(
  propostaId: string,
  snapshot: unknown,
  valorTotal: number,
  geradoPor: string | null,
): Promise<number> {
  const supabase = createClient()
  const { data: ultima } = await supabase
    .from("versoes_proposta")
    .select("versao")
    .eq("proposta_id", propostaId)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle()
  const versao = (ultima?.versao ?? 0) + 1
  const { error } = await supabase.from("versoes_proposta").insert({
    proposta_id: propostaId,
    versao,
    snapshot: snapshot as any,
    valor_total: valorTotal,
    gerado_por: geradoPor,
  })
  if (error) throw error
  return versao
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

// Recupera o snapshot (PropostaDoc) salvo em uma versão específica, para
// visualizar/baixar exatamente como o documento estava naquele momento — sem
// reimplementar a geração (o snapshot é o mesmo `doc` produzido por montarDocumento).
export async function getVersaoSnapshot(
  propostaId: string,
  versao: number,
): Promise<PropostaDoc | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("versoes_proposta")
    .select("snapshot")
    .eq("proposta_id", propostaId)
    .eq("versao", versao)
    .maybeSingle()
  if (error) throw error
  return (data?.snapshot as PropostaDoc | undefined) ?? null
}
