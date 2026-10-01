import { describe, expect, it } from "vitest"
import { docExemplo, empresaExemplo, itensExemplo } from "@/test/documento-exemplo"
import { recursosDoDisco } from "@/test/recursos-documento"
import { montarPdf } from "./pdf"
import { RECURSOS_VAZIOS } from "./recursos"

// Sem a fonte embutida o jsPDF escreve o texto literal (Helvetica), o que
// permite procurar strings no PDF cru.
const semFonte = () => recursosDoDisco({ fontes: false })

describe("montarPdf", () => {
  // Capa, Quem somos, Metodologia, Apresentação + escopo, resto do escopo +
  // total, Condições.
  it("gera 6 páginas para a proposta de exemplo", () => {
    expect(montarPdf(docExemplo(), empresaExemplo(), semFonte()).getNumberOfPages()).toBe(6)
  })

  it("escreve valores com centavos, a marca e o rodapé YRM", () => {
    const cru = montarPdf(docExemplo(), empresaExemplo(), semFonte()).output()
    expect(cru).toContain("123.160,00")
    expect(cru).toContain("30.400,00")
    expect(cru).toContain("36.948,00")
    expect(cru).toContain("IEX Projetos")
    expect(cru).toContain("Powered by YRM Strategy Lab")
    expect(cru).toContain("1.400")
    expect(cru).toContain("Credibilidade")
  })

  it("usa o texto de rodapé configurado no lugar do YRM padrão", () => {
    const cru = montarPdf(docExemplo(), empresaExemplo({ textoRodape: "Rodapé próprio" }), semFonte()).output()
    expect(cru).toContain("Rodap")
    expect(cru).not.toContain("Powered by YRM Strategy Lab")
  })

  it("leva o escopo para mais páginas com 12 disciplinas", () => {
    const itens = itensExemplo(12)
    const doc = docExemplo({ itens, total: itens.reduce((s, i) => s + i.valor, 0) })
    const curto = montarPdf(docExemplo(), empresaExemplo(), semFonte()).getNumberOfPages()
    expect(montarPdf(doc, empresaExemplo(), semFonte()).getNumberOfPages()).toBeGreaterThan(curto)
  })

  it("aceita proposta sem parcelas, premissas, exclusões e dados bancários", () => {
    const doc = docExemplo({ parcelas: [], premissas: [], exclusoes: [], observacoes: "Prazo conta a partir do recebimento do arquitetônico." })
    const cru = montarPdf(doc, empresaExemplo({ dadosBancarios: null }), semFonte()).output()
    expect(cru).toContain("Parcelado por etapa")
    expect(cru).toContain("Observa")
  })

  it("embute a Manrope quando a fonte está disponível", () => {
    const pdf = montarPdf(docExemplo(), empresaExemplo(), recursosDoDisco({ fontes: true }))
    expect(pdf.getNumberOfPages()).toBe(6)
    expect(pdf.output()).toContain("Manrope")
  })

  it("não falha sem nenhuma imagem nem fonte", () => {
    expect(montarPdf(docExemplo(), empresaExemplo(), RECURSOS_VAZIOS).getNumberOfPages()).toBe(6)
  })
})
