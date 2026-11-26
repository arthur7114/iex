import { describe, expect, it } from "vitest"
import type { Disciplina, TipoEmpreendimento } from "@/lib/db/types"
import { disciplinasPadraoDoTipo, trocarDisciplinasPadrao } from "./disciplinas-padrao"

const disciplinas = ["agua", "esgoto", "eletrica"].map<Disciplina>((id) => ({
  id,
  nome: id,
  tituloProposta: id,
  descricao: "",
  valorBaseM2: 0,
  valorMinimo: 0,
  exigeAprovacao: false,
  escopoPadrao: [],
}))

const tipos: TipoEmpreendimento[] = [
  { id: "1", nome: "Loteamento", ordem: 1, ativo: true, disciplinasPadrao: ["esgoto", "desativada", "agua"] },
  { id: "2", nome: "Comercial", ordem: 2, ativo: true, disciplinasPadrao: [] },
]

describe("disciplinas padrão por tipo", () => {
  it("usa somente disciplinas ativas, na ordem do catálogo, e deixa tipos sem configuração vazios", () => {
    expect(disciplinasPadraoDoTipo("Loteamento", tipos, disciplinas)).toEqual(["agua", "esgoto"])
    expect(disciplinasPadraoDoTipo("Comercial", tipos, disciplinas)).toEqual([])
    expect(disciplinasPadraoDoTipo("Tipo legado", tipos, disciplinas)).toEqual([])
  })

  it("ao trocar o tipo, remove o padrão anterior sem apagar ou duplicar escolhas manuais", () => {
    const nova = trocarDisciplinasPadrao(["agua", "eletrica"], ["agua"], ["esgoto", "eletrica"])
    expect(nova).toEqual({ selecionadas: ["esgoto", "eletrica"], automaticas: ["esgoto"] })
    expect(trocarDisciplinasPadrao(nova.selecionadas, nova.automaticas, [])).toEqual({
      selecionadas: ["eletrica"], automaticas: [],
    })
  })
})
