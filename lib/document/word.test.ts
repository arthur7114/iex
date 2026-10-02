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
})
