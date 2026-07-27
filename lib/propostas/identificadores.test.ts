import { describe, expect, it } from "vitest"
import {
  formatarCodigoProposta,
  identificacaoDocumento,
  nomeDocumentoVersionado,
  rotuloVersao,
} from "./identificadores"

describe("formatarCodigoProposta", () => {
  it("usa data invertida e sequência diária com dois dígitos", () => {
    expect(formatarCodigoProposta("2026-07-27", 1)).toBe("20260727-01")
    expect(formatarCodigoProposta("2026-07-27", 12)).toBe("20260727-12")
  })

  it("não trunca sequências acima de 99", () => {
    expect(formatarCodigoProposta("2026-07-27", 100)).toBe("20260727-100")
  })
})

describe("identificação da versão", () => {
  it("formata o rótulo e o arquivo sem alterar o código-base", () => {
    expect(rotuloVersao(2)).toBe("V2")
    expect(nomeDocumentoVersionado("20260727-01", 2, "pdf")).toBe("20260727-01-V2.pdf")
    expect(nomeDocumentoVersionado("20260727-01", 2, "docx")).toBe("20260727-01-V2.docx")
  })

  it("não inventa V0 para um documento legado sem snapshot", () => {
    expect(identificacaoDocumento("PRP-2026-0001", 0)).toBe("PRP-2026-0001")
    expect(nomeDocumentoVersionado("PRP-2026-0001", 0, "pdf")).toBe("PRP-2026-0001.pdf")
  })
})
