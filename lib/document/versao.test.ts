import { describe, expect, it } from "vitest"
import { normalizarSnapshotVersao } from "./versao"
import { assinaturaDoDocumento, CARGO_SIGNATARIO_PADRAO } from "./tipos"

const docLegado = {
  numero: "PRP-2026-0001",
  cliente: "Cliente legado",
  itens: [],
  responsavel: "Ana Autora",
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

  // Propostas anteriores ao campo não têm assinatura própria: a normalização
  // não pode inventar uma, e a resolução cai no autor com o cargo padrão.
  it("mantém snapshot sem assinatura própria e deixa o padrão para a renderização", () => {
    const result = normalizarSnapshotVersao(
      { schemaVersion: 2, doc: { ...docLegado, versao: 1 }, empresa: empresaAtual },
      1,
      empresaAtual,
    )

    expect(result.doc.assinaturaNome).toBeUndefined()
    expect(result.doc.assinaturaCargo).toBeUndefined()
    expect(assinaturaDoDocumento(result.doc)).toEqual({
      nome: "Ana Autora",
      cargo: CARGO_SIGNATARIO_PADRAO,
    })
  })

  it("congela a assinatura gravada no snapshot", () => {
    const result = normalizarSnapshotVersao(
      {
        schemaVersion: 2,
        doc: {
          ...docLegado,
          versao: 3,
          assinaturaNome: "Alderi Diretor",
          assinaturaCargo: "Diretor Comercial",
        },
        empresa: empresaAtual,
      },
      3,
      empresaAtual,
    )

    // Quem assina não é quem redigiu: o autor segue no documento para auditoria.
    expect(result.doc.responsavel).toBe("Ana Autora")
    expect(assinaturaDoDocumento(result.doc)).toEqual({
      nome: "Alderi Diretor",
      cargo: "Diretor Comercial",
    })
  })
})

describe("assinaturaDoDocumento", () => {
  const base = { responsavel: "Ana Autora" }

  it("assina com o autor quando a proposta não escolhe signatário", () => {
    expect(assinaturaDoDocumento(base)).toEqual({
      nome: "Ana Autora",
      cargo: CARGO_SIGNATARIO_PADRAO,
    })
  })

  it("permite trocar nome e cargo de quem assina", () => {
    expect(
      assinaturaDoDocumento({ ...base, assinaturaNome: "Alderi", assinaturaCargo: "Diretor Comercial" }),
    ).toEqual({ nome: "Alderi", cargo: "Diretor Comercial" })
  })

  it("aceita trocar só o cargo, mantendo o autor como signatário", () => {
    expect(assinaturaDoDocumento({ ...base, assinaturaCargo: "Assistente Comercial" })).toEqual({
      nome: "Ana Autora",
      cargo: "Assistente Comercial",
    })
  })

  it("ignora valores em branco e volta ao fallback", () => {
    expect(assinaturaDoDocumento({ ...base, assinaturaNome: "   ", assinaturaCargo: "  " })).toEqual({
      nome: "Ana Autora",
      cargo: CARGO_SIGNATARIO_PADRAO,
    })
  })

  it("usa a razão social quando não há autor nem signatário", () => {
    expect(assinaturaDoDocumento({ responsavel: "" }, "IEX Projetos")).toEqual({
      nome: "IEX Projetos",
      cargo: CARGO_SIGNATARIO_PADRAO,
    })
  })
})
