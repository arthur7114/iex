import { Packer, type Document } from "docx"
import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import { docExemplo, empresaExemplo } from "@/test/documento-exemplo"
import { recursosDoDisco } from "@/test/recursos-documento"
import { RECURSOS_VAZIOS } from "./recursos"
import { montarWord } from "./word"

async function xml(documento: Document) {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(documento))
  const ler = (padrao: RegExp) =>
    Promise.all(Object.keys(zip.files).filter((f) => padrao.test(f)).map((f) => zip.file(f)!.async("string"))).then((s) => s.join(""))
  return { corpo: await ler(/^word\/document\.xml$/), rodape: await ler(/^word\/footer\d+\.xml$/), cabecalho: await ler(/^word\/header\d+\.xml$/) }
}

describe("montarWord", () => {
  it("traz capa, Quem somos, valores com centavos e condições", async () => {
    const { corpo } = await xml(montarWord(docExemplo(), empresaExemplo(), recursosDoDisco({ fontes: false })))
    for (const trecho of ["Clínica Vida Plena", "Projetos executivos de:", "Quem somos", "Credibilidade", "1.400", "123.160,00", "30.400,00", "36.948,00", "Como trabalhamos", "Não incluso", "CREA", "Alderi Sousa"]) {
      expect(corpo, trecho).toContain(trecho)
    }
  })
  it("põe a marca e o rodapé YRM em cabeçalho e rodapé", async () => {
    const { rodape, cabecalho } = await xml(montarWord(docExemplo(), empresaExemplo(), recursosDoDisco({ fontes: false })))
    expect(rodape).toContain("Powered by YRM Strategy Lab")
    expect(rodape).toContain("IEX Projetos")
    expect(cabecalho).toContain("20260928-01")
  })
  it("não falha sem imagens", async () => {
    const { corpo } = await xml(montarWord(docExemplo({ parcelas: [], observacoes: "Obs." }), empresaExemplo({ dadosBancarios: null }), RECURSOS_VAZIOS))
    expect(corpo).toContain("Parcelado por etapa")
    expect(corpo).toContain("Obs.")
  })

  it("quebra os dados bancários em linhas com w:br, sem LF dentro de w:t", async () => {
    const { corpo } = await xml(montarWord(docExemplo(), empresaExemplo(), RECURSOS_VAZIOS))
    const celula = corpo.split("Dados bancários")[1].split("</w:tc>")[1]
    expect(corpo).not.toMatch(/<w:t[^>]*>[^<]*\n[^<]*<\/w:t>/)
    // Banco, conta, PIX e favorecido: quatro linhas, três quebras.
    expect(celula.match(/<w:br\/>/g)).toHaveLength(3)
    expect(celula).toContain("Banco do Brasil")
    expect(celula).toContain("PIX 45.546.897/0001-91")
    expect(celula).toContain("IEX Projetos")
  })
  it("gera um parágrafo por linha na apresentação e nas observações", async () => {
    const { corpo } = await xml(montarWord(docExemplo({ apresentacao: "Primeira linha.\nSegunda linha.", observacoes: "Obs A.\n\nObs B." }), empresaExemplo(), RECURSOS_VAZIOS))
    for (const t of ["Primeira linha.", "Segunda linha.", "Obs A.", "Obs B."]) {
      expect(corpo.match(new RegExp(`<w:t[^>]*>${t}</w:t>`, "g")), t).toHaveLength(1)
    }
    const paragrafoDe = (t: string) => corpo.slice(corpo.lastIndexOf("<w:p>", corpo.indexOf(t)), corpo.indexOf(t))
    expect(paragrafoDe("Segunda linha.")).not.toContain("Primeira linha.")
    expect(paragrafoDe("Obs B.")).not.toContain("Obs A.")
  })
  it("não repete wp:docPr id entre corpo, cabeçalho e rodapé", async () => {
    const documento = montarWord(docExemplo(), empresaExemplo({ assinaturaDataUrl: recursosDoDisco({ fontes: false }).imagens.logoBranco }), recursosDoDisco({ fontes: false }))
    const { corpo, cabecalho, rodape } = await xml(documento)
    const ids = [...(corpo + cabecalho + rodape).matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => m[1])
    expect(ids.length).toBeGreaterThan(5)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it("embute as fotos grandes como JPEG com a proporção do arquivo", async () => {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(montarWord(docExemplo(), empresaExemplo(), recursosDoDisco({ fontes: false }))))
    expect(Object.keys(zip.files).filter((f) => /^word\/media\/.+\.jpg$/.test(f))).toHaveLength(2)
    const corpo = await zip.file("word/document.xml")!.async("string")
    // Metodologia (1740 x 560 px) entra em 174 mm de largura, na proporção do arquivo.
    const cx = [...corpo.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].map((m) => Number(m[1]) / Number(m[2]))
    expect(cx.some((r) => Math.abs(r - 1740 / 560) < 0.02)).toBe(true)
  })
  it("capa legível sem a imagem de fundo: título em navy, não branco", async () => {
    const { corpo } = await xml(montarWord(docExemplo(), empresaExemplo(), RECURSOS_VAZIOS))
    const trecho = corpo.slice(0, corpo.indexOf("Quem somos"))
    expect(trecho).toContain("Clínica Vida Plena")
    expect(trecho).not.toMatch(/w:color w:val="FFFFFF"/i)
  })
})
