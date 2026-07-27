import { describe, expect, it } from "vitest"
import { calcularMultiplicador, calcularValorSugerido } from "../propostas/precificacao"
import { calcularParcelas } from "../document/util"

describe("precificação de propostas", () => {
  it("calcula por m² e respeita o valor mínimo", () => {
    expect(calcularValorSugerido(1_000, 2.5, 1_000, 1)).toBe(2_500)
    expect(calcularValorSugerido(100, 2.5, 1_000, 1)).toBe(1_000)
  })

  it("trata base zero como serviço de valor fixo", () => {
    expect(calcularValorSugerido(20_000, 0, 3_500, 2)).toBe(3_500)
  })

  it("aplica complexidade somente quando selecionada", () => {
    const variaveis = [
      {
        id: "1",
        chave: "padrao",
        nome: "Padrão",
        descricao: "",
        opcoes: { Normal: 0, Alto: 0.25 },
        ordem: 1,
        ativo: true,
      },
    ]
    expect(calcularMultiplicador(variaveis, {})).toBe(1)
    expect(calcularMultiplicador(variaveis, { padrao: "Alto" })).toBe(1.25)
  })

  it("divide o total em 40/40/20 sem alterar o total", () => {
    const parcelas = calcularParcelas("40/40/20", 10_000)
    expect(parcelas.map((parcela) => parcela.valor)).toEqual([4_000, 4_000, 2_000])
    expect(parcelas.reduce((soma, parcela) => soma + parcela.valor, 0)).toBe(10_000)
  })
})
