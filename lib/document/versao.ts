import type { EmpresaDoc, PropostaDoc, VersaoSnapshot } from "./tipos"

function isSnapshotAtual(snapshot: unknown): snapshot is VersaoSnapshot {
  if (!snapshot || typeof snapshot !== "object") return false
  const value = snapshot as Partial<VersaoSnapshot>
  return value.schemaVersion === 2 && Boolean(value.doc) && Boolean(value.empresa)
}

export function normalizarSnapshotVersao(
  snapshot: unknown,
  versao: number,
  empresaAtual: EmpresaDoc,
): VersaoSnapshot {
  if (isSnapshotAtual(snapshot)) {
    return {
      ...snapshot,
      doc: { ...snapshot.doc, versao },
    }
  }

  return {
    schemaVersion: 2,
    doc: { ...(snapshot as PropostaDoc), versao },
    empresa: empresaAtual,
  }
}
