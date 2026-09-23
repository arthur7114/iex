import { describe, expect, it } from "vitest"
import {
  corDaMarca,
  montarAssinatura,
  montarCorpoEmail,
  srcInline,
  type DadosAssinatura,
  type MarcaEmpresa,
} from "./assinatura"

const base: DadosAssinatura = {
  modo: "html",
  nome: "Arthur Brito",
  cargo: "Diretor Comercial",
  telefone: "(81) 99999-0000",
  email: "arthur@iex.com",
  fotoPath: "assinaturas/u1/foto-1.png",
  imagemPath: null,
}
const marca: MarcaEmpresa = { razaoSocial: "IEX Engenharia", logoPath: "logo/1.png", corPrimaria: "#1A2B3C" }

describe("corDaMarca", () => {
  it("normaliza hex de 6 dígitos com ou sem #", () => {
    expect(corDaMarca("1A2B3C")).toBe("#1a2b3c")
    expect(corDaMarca("#1a2b3c")).toBe("#1a2b3c")
  })

  it("cai no navy padrão para oklch, vazio ou inválido", () => {
    expect(corDaMarca("oklch(0.3 0.1 250)")).toBe("#243658")
    expect(corDaMarca(null)).toBe("#243658")
  })
})

describe("montarAssinatura — modo HTML", () => {
  it("inclui foto, dados, logo e cor, com CIDs", () => {
    const a = montarAssinatura(base, marca, srcInline)
    expect(a.imagens).toEqual([
      { cid: "assinatura-foto", path: "assinaturas/u1/foto-1.png" },
      { cid: "assinatura-logo", path: "logo/1.png" },
    ])
    expect(a.html).toContain('src="cid:assinatura-foto"')
    expect(a.html).toContain('src="cid:assinatura-logo"')
    expect(a.html).toContain("Arthur Brito")
    expect(a.html).toContain("Diretor Comercial")
    expect(a.html).toContain('href="mailto:arthur@iex.com"')
    expect(a.html).toContain("#1a2b3c")
    expect(a.texto).toBe("Arthur Brito\nDiretor Comercial\n(81) 99999-0000\narthur@iex.com\nIEX Engenharia")
  })

  it("sem foto nem logo: sem imagens e com a razão social em texto", () => {
    const a = montarAssinatura({ ...base, fotoPath: null, cargo: null, telefone: null }, { ...marca, logoPath: null }, srcInline)
    expect(a.imagens).toEqual([])
    expect(a.html).not.toContain("<img")
    expect(a.html).toContain("IEX Engenharia")
    expect(a.texto).toBe("Arthur Brito\narthur@iex.com\nIEX Engenharia")
  })

  it("escapa HTML nos campos", () => {
    const a = montarAssinatura({ ...base, nome: "<script>x</script>" }, marca, srcInline)
    expect(a.html).not.toContain("<script>")
    expect(a.html).toContain("&lt;script&gt;")
  })

  it("modo nulo equivale a HTML", () => {
    expect(montarAssinatura({ ...base, modo: null }, marca, srcInline).html).toContain("Arthur Brito")
  })
})

describe("montarAssinatura — modo imagem", () => {
  it("usa só a imagem enviada", () => {
    const a = montarAssinatura({ ...base, modo: "imagem", imagemPath: "assinaturas/u1/imagem-1.png" }, marca, srcInline)
    expect(a.imagens).toEqual([{ cid: "assinatura-imagem", path: "assinaturas/u1/imagem-1.png" }])
    expect(a.html).toContain('src="cid:assinatura-imagem"')
    expect(a.html).not.toContain("assinatura-foto")
  })

  it("sem arquivo cai para HTML", () => {
    const a = montarAssinatura({ ...base, modo: "imagem", imagemPath: null }, marca, srcInline)
    expect(a.html).toContain("assinatura-foto")
  })

  it("o resolvedor define o src (prévia usa URL pública)", () => {
    const a = montarAssinatura({ ...base, modo: "imagem", imagemPath: "p.png" }, marca, (i) => `https://cdn/${i.path}`)
    expect(a.html).toContain('src="https://cdn/p.png"')
  })
})

describe("montarCorpoEmail", () => {
  it("junta corpo e assinatura em texto e em HTML escapado", () => {
    const a = { html: "<table>ass</table>", texto: "Arthur", imagens: [] }
    const r = montarCorpoEmail("Olá <Maria>\nTudo bem?", a)
    expect(r.texto).toBe("Olá <Maria>\nTudo bem?\n\n--\nArthur")
    expect(r.html).toContain("Olá &lt;Maria&gt;<br>Tudo bem?")
    expect(r.html).toContain("<table>ass</table>")
  })
})
