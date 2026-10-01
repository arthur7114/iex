import { describe, expect, it } from "vitest"
import {
  contatoRodape, dataPorExtenso, EMPRESA_PADRAO, fichaEmpreendimento, formatarPercentual, iconeDisciplina,
  linhasBancarias, mesAno, paginar, percentual, rotuloParcela, subtituloCapa, tituloCapa,
} from "./layout-a"

describe("tituloCapa", () => {
  it("quebra o empreendimento no travessão", () => {
    expect(tituloCapa("Clínica Vida Plena — Unidade Aldeota")).toEqual(["Clínica Vida Plena", "Unidade Aldeota"])
  })
  it("mantém uma linha quando não há travessão", () => {
    expect(tituloCapa("Residencial Aurora")).toEqual(["Residencial Aurora"])
  })
  it("usa um título genérico quando vazio", () => {
    expect(tituloCapa("   ")).toEqual(["Proposta comercial"])
  })
})

describe("subtituloCapa", () => {
  it("lista as disciplinas sem prefixos, com 'e' antes da última", () => {
    expect(
      subtituloCapa([{ disciplina: "Instalações elétricas" }, { disciplina: "Hidráulica" }, { disciplina: "SPDA" }]),
    ).toBe("Projetos executivos de: elétricas, hidráulica e SPDA.")
  })
  it("tira 'Prevenção e combate a' e trata uma disciplina só", () => {
    expect(subtituloCapa([{ disciplina: "Prevenção e combate a incêndio" }])).toBe("Projetos executivos de: incêndio.")
  })
  it("cai num texto genérico sem disciplinas", () => {
    expect(subtituloCapa([])).toBe("Projetos executivos de engenharia.")
  })
})

describe("iconeDisciplina", () => {
  it.each([
    ["Instalações elétricas", "eletrica"],
    ["Hidráulica", "hidraulica"],
    ["Hidrossanitário", "hidraulica"],
    ["Sanitária", "sanitaria"],
    ["Águas pluviais", "sanitaria"],
    ["Prevenção e combate a incêndio", "incendio"],
    ["Climatização", "climatizacao"],
    ["Exaustão de cozinhas", "climatizacao"],
    ["SPDA", "spda"],
    ["CFTV", "dados"],
    ["Rede de gases medicinais", "gas"],
    ["Estrutural", "estrutura"],
    ["Fotovoltaica", "fotovoltaica"],
    ["Paisagismo", "generico"],
  ])("%s → %s", (nome, id) => {
    expect(iconeDisciplina(nome)).toBe(id)
  })
})

describe("percentuais e parcelas", () => {
  it("calcula o percentual com uma casa", () => {
    expect(percentual(30400, 123160)).toBe(24.7)
    expect(percentual(10, 0)).toBe(0)
  })
  it("formata o percentual em pt-BR", () => {
    expect(formatarPercentual(24.7)).toBe("24,7%")
    expect(formatarPercentual(30)).toBe("30%")
  })
  it("tira o percentual que já vem na descrição da parcela", () => {
    expect(rotuloParcela("Assinatura do contrato (30%)")).toBe("Assinatura do contrato")
    expect(rotuloParcela("Entrega do executivo (marco — 40%)")).toBe("Entrega do executivo · marco")
    expect(rotuloParcela("Conforme combinado")).toBe("Conforme combinado")
  })
})

describe("fichaEmpreendimento", () => {
  const base = { cliente: "Grupo Vida", contato: "Mariana", tipo: "Clínica", cidade: "Fortaleza", uf: "CE", area: 1850, itens: [{ disciplina: "A", valor: 1 }, { disciplina: "B", valor: 1 }] }
  it("monta os seis campos", () => {
    expect(fichaEmpreendimento(base)).toEqual([
      ["Cliente", "Grupo Vida"], ["Contato", "Mariana"], ["Tipologia", "Clínica"],
      ["Localização", "Fortaleza/CE"], ["Área total", "1.850 m²"], ["Disciplinas", "2 projetos"],
    ])
  })
  it("omite campos vazios e área zero", () => {
    expect(fichaEmpreendimento({ ...base, contato: " ", area: 0, cidade: "", uf: "", itens: [{ disciplina: "A", valor: 1 }] })).toEqual([
      ["Cliente", "Grupo Vida"], ["Tipologia", "Clínica"], ["Disciplinas", "1 projeto"],
    ])
  })
})

describe("linhasBancarias e contatoRodape", () => {
  it("monta as linhas só com o que existe", () => {
    expect(linhasBancarias(null)).toEqual([])
    expect(linhasBancarias({ banco: "Banco do Brasil", agencia: "1234", conta: "5678-9", pix: "00.000", favorecido: "IEX Projetos" })).toEqual([
      "Banco do Brasil", "Ag. 1234 · C/C 5678-9", "PIX 00.000", "IEX Projetos",
    ])
    expect(linhasBancarias({ pix: "chave" })).toEqual(["PIX chave"])
  })
  it("completa o rodapé com os dados padrão da IEX", () => {
    expect(contatoRodape({ razaoSocial: "", endereco: "", telefone: "" })).toBe(
      `${EMPRESA_PADRAO.razaoSocial} · ${EMPRESA_PADRAO.endereco} · ${EMPRESA_PADRAO.telefone}`,
    )
    expect(contatoRodape({ razaoSocial: "IEX X", endereco: "Rua A", telefone: "1" })).toBe("IEX X · Rua A · 1")
  })
})

describe("datas", () => {
  const d = new Date(2026, 8, 28)
  it("escreve a data por extenso", () => expect(dataPorExtenso(d)).toBe("28 de setembro de 2026"))
  it("escreve mês/ano", () => expect(mesAno(d)).toBe("setembro/2026"))
})

describe("paginar", () => {
  it("põe tudo numa página quando cabe", () => {
    expect(paginar([{ altura: 50 }, { altura: 50 }, { altura: 50 }], 200)).toEqual([[0, 1, 2]])
  })
  it("abre página nova quando o bloco não cabe", () => {
    expect(paginar([{ altura: 120 }, { altura: 100 }], 200)).toEqual([[0], [1]])
  })
  it("respeita quebraAntes sem criar página vazia", () => {
    expect(paginar([{ altura: 10, quebraAntes: true }, { altura: 10, quebraAntes: true }], 200)).toEqual([[0], [1]])
  })
  it("leva o título junto com o bloco seguinte", () => {
    expect(paginar([{ altura: 180 }, { altura: 13, manterComProximo: true }, { altura: 30 }], 200)).toEqual([[0], [1, 2]])
  })
  it("dá uma página só ao bloco maior que a área útil", () => {
    expect(paginar([{ altura: 10 }, { altura: 300 }, { altura: 10 }], 200)).toEqual([[0], [1], [2]])
  })
})
