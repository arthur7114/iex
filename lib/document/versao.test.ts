import { describe, expect, it } from "vitest"
import { normalizarSnapshotVersao } from "./versao"

const docLegado = {
  numero: "PRP-2026-0001",
  cliente: "Cliente legado",
  itens: [],
}

const empresaAtual = {
  razaoSocial: "IEX Atual",
  cnpj: "",
  endereco: "",
  telefone: "",
  email: "",
  textoRodape: "",
  dadosBancarios: null,
}

describe("normalizarSnapshotVersao", () => {
  it("mantém documento e branding gravados no snapshot novo", () => {
    const snapshot = {
      schemaVersion: 2,
      doc: { ...docLegado, numero: "20260727-01", versao: 2 },
      empresa: { ...empresaAtual, razaoSocial: "IEX da época" },
    }

    const result = normalizarSnapshotVersao(snapshot, 2, empresaAtual)

    expect(result.doc.versao).toBe(2)
    expect(result.empresa.razaoSocial).toBe("IEX da época")
  })

  it("preserva snapshot legado e usa branding atual apenas como fallback compatível", () => {
    const result = normalizarSnapshotVersao(docLegado, 1, empresaAtual)

    expect(result.doc.numero).toBe("PRP-2026-0001")
    expect(result.doc.versao).toBe(1)
    expect(result.empresa.razaoSocial).toBe("IEX Atual")
  })
})
