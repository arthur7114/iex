import { Packer } from "docx"
import { describe, expect, it } from "vitest"
import { docExemplo, empresaExemplo } from "@/test/documento-exemplo"
import { recursosDoDisco } from "@/test/recursos-documento"
import { montarPdf } from "./pdf"
import { montarWord } from "./word"

// O PDF e o Word seguem por e-mail como base64 num argumento de Server Action
// (enviarProposta); o corpo da requisição é limitado a 10 MB em next.config.mjs,
// mas o padrão do Next é 1 MB. Este teste mantém os anexos de exemplo (com a
// fonte e todas as imagens) com folga abaixo disso.
const LIMITE_ARQUIVO = 900 * 1024
const LIMITE_BASE64 = 1024 * 1024

const base64 = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64")

describe("tamanho dos anexos da proposta de exemplo", () => {
  it("PDF fica abaixo de 900 KB (e do 1 MB em base64)", () => {
    const bytes = montarPdf(docExemplo(), empresaExemplo(), recursosDoDisco({ fontes: true })).output("arraybuffer")
    expect(bytes.byteLength).toBeLessThan(LIMITE_ARQUIVO)
    expect(base64(bytes).length).toBeLessThan(LIMITE_BASE64)
  })

  it("Word fica abaixo de 900 KB (e do 1 MB em base64)", async () => {
    const buffer = await Packer.toBuffer(montarWord(docExemplo(), empresaExemplo(), recursosDoDisco({ fontes: true })))
    expect(buffer.byteLength).toBeLessThan(LIMITE_ARQUIVO)
    expect(base64(buffer).length).toBeLessThan(LIMITE_BASE64)
  })
})
