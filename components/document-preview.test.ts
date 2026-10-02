import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { docExemplo } from "@/test/documento-exemplo"
import { DocumentPreview } from "./document-preview"

const html = (parcial = {}) => renderToStaticMarkup(createElement(DocumentPreview, { data: docExemplo(parcial) }))

describe("DocumentPreview", () => {
  it("mostra as 5 folhas do Modelo A v2", () => {
    expect(html().match(/<section/g)).toHaveLength(5)
  })
  it("traz valores com centavos, institucional e rodapé YRM", () => {
    const h = html()
    expect(h).toContain("123.160,00")
    expect(h).toContain("30.400,00")
    expect(h).toContain("Quem somos")
    expect(h).toContain("Credibilidade")
    expect(h).not.toContain("Etapas deste projeto")
    expect(h).toContain("1.400")
    expect(h).toContain("Powered by YRM Strategy Lab")
    expect(h).toContain("/documento/socios.png")
    expect(h).toContain("/documento/icones/eletrica.png")
  })
  it("mostra observações só quando existem", () => {
    expect(html()).not.toContain("Observações")
    expect(html({ observacoes: "Prazo a partir do arquitetônico." })).toContain("Observações")
  })
})
