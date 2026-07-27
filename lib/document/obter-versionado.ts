import { getVersaoSnapshot } from "@/lib/db/versoes"
import { montarDocumento } from "./montar"
import { normalizarSnapshotVersao } from "./versao"
import type { EmpresaDoc, PropostaDoc } from "./tipos"

export async function obterDocumentoVersionado(
  propostaId: string,
  versao: number,
  opcoes: { exigirSnapshot?: boolean } = {},
): Promise<{ doc: PropostaDoc; empresa: EmpresaDoc } | null> {
  const atual = await montarDocumento(propostaId)
  if (!atual) return null
  if (versao <= 0) return atual

  const snapshot = await getVersaoSnapshot(propostaId, versao)
  if (!snapshot) return opcoes.exigirSnapshot ? null : atual

  const normalizado = normalizarSnapshotVersao(snapshot, versao, atual.empresa)
  return { doc: normalizado.doc, empresa: normalizado.empresa }
}
