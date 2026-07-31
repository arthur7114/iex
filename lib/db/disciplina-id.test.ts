import { describe, it, expect } from "vitest"
import { idDisciplinaUnico } from "./disciplina-id"

describe("idDisciplinaUnico", () => {
  it("usa o slug do nome quando o id está livre", () => {
    expect(idDisciplinaUnico("Projeto de instalações de grupo gerador", [])).toBe(
      "projeto-de-instalacoes-de-grupo-gerador",
    )
  })

  it("adiciona sufixo -2 quando o slug já existe (caso do bug: nome duplicado)", () => {
    const existentes = ["projeto-de-instalacoes-de-grupo-gerador"]
    expect(
      idDisciplinaUnico("Projeto de instalações de grupo gerador", existentes),
    ).toBe("projeto-de-instalacoes-de-grupo-gerador-2")
  })

  it("procura o próximo sufixo livre (-3) quando -2 também está ocupado", () => {
    const existentes = new Set(["eletrica-bt", "eletrica-bt-2"])
    expect(idDisciplinaUnico("Elétrica BT", existentes)).toBe("eletrica-bt-3")
  })

  it("nomes distintos que geram o mesmo slug não colidem", () => {
    // "Área Técnica" e "Area Tecnica" produzem o mesmo slug após remover acentos.
    const primeiro = idDisciplinaUnico("Área Técnica", [])
    const segundo = idDisciplinaUnico("Area Tecnica", [primeiro])
    expect(primeiro).toBe("area-tecnica")
    expect(segundo).toBe("area-tecnica-2")
  })

  it("nome só com símbolos (slug vazio) cai no fallback 'disciplina'", () => {
    expect(idDisciplinaUnico("———", [])).toBe("disciplina")
    expect(idDisciplinaUnico("!!!", ["disciplina"])).toBe("disciplina-2")
  })
})
