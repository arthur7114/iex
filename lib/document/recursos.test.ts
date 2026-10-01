import { describe, expect, it } from "vitest"
import { recursosDoDisco } from "@/test/recursos-documento"
import { ICONES } from "./layout-a"

describe("recursos do documento", () => {
  it("encontra fonte, imagens e todos os ícones em public/", () => {
    const r = recursosDoDisco({ fontes: true })
    expect(r.fontes).not.toBeNull()
    for (const peso of ["regular", "semibold", "bold", "extrabold"] as const) expect(r.fontes![peso].length).toBeGreaterThan(1000)
    for (const [nome, url] of Object.entries(r.imagens)) expect(url, nome).toMatch(/^data:image\/png;base64,/)
    for (const id of ICONES) expect(r.icones[id], id).toMatch(/^data:image\/png;base64,/)
  })
})
