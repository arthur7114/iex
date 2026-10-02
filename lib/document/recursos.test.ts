import { describe, expect, it } from "vitest"
import { recursosDoDisco } from "@/test/recursos-documento"
import { CAMINHO_IMAGEM, mimeDaImagem } from "./recursos"
import { ICONES } from "./layout-a"

// Assinaturas dos formatos em base64: PNG = 89 50 4E 47 0D 0A 1A 0A; JPEG = FF D8 FF.
const PNG = "data:image/png;base64,iVBORw0KGgo"
const JPEG = "data:image/jpeg;base64,/9j/"

describe("recursos do documento", () => {
  it("encontra fonte, imagens e todos os ícones em public/", () => {
    const r = recursosDoDisco({ fontes: true })
    expect(r.fontes).not.toBeNull()
    for (const peso of ["regular", "semibold", "bold", "extrabold"] as const) expect(r.fontes![peso].length).toBeGreaterThan(1000)
    for (const [nome, url] of Object.entries(r.imagens)) expect(url, nome).toMatch(/^data:image\/(png|jpeg);base64,/)
    for (const id of ICONES) expect(r.icones[id], id).toMatch(/^data:image\/png;base64,/)
  })

  it("o tipo declarado de cada imagem bate com os bytes do arquivo", () => {
    const r = recursosDoDisco({ fontes: false })
    for (const [nome, url] of Object.entries(r.imagens)) {
      const esperado = mimeDaImagem(CAMINHO_IMAGEM[nome as keyof typeof CAMINHO_IMAGEM]) === "image/jpeg" ? JPEG : PNG
      expect(url!.startsWith(esperado), nome).toBe(true)
    }
    // As duas fotos grandes são JPEG (anexo de e-mail abaixo de 1 MB).
    expect(r.imagens.socios!.startsWith(JPEG)).toBe(true)
    expect(r.imagens.metodologia!.startsWith(JPEG)).toBe(true)
    for (const id of ICONES) expect(r.icones[id]!.startsWith(PNG), id).toBe(true)
  })

  it("deduz o MIME pela extensão", () => {
    expect(mimeDaImagem("/documento/socios.jpg")).toBe("image/jpeg")
    expect(mimeDaImagem("/documento/x.JPEG")).toBe("image/jpeg")
    expect(mimeDaImagem("/documento/logo-branco.png")).toBe("image/png")
  })
})
