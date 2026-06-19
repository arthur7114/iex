import { createClient } from "@/lib/supabase/client"

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
