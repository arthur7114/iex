import { afterEach, describe, expect, it, vi } from "vitest"
import { docExemplo, empresaExemplo, itensExemplo } from "@/test/documento-exemplo"
import { recursosDoDisco } from "@/test/recursos-documento"
import { montarPdf } from "./pdf"
import { RECURSOS_VAZIOS } from "./recursos"

// Sem a fonte embutida o jsPDF escreve o texto literal (Helvetica), o que
// permite procurar strings no PDF cru.
const semFonte = () => recursosDoDisco({ fontes: false })

// Texto cru de cada página (índice 0 = capa). O PDF sai comprimido, então os
// testes leem o conteúdo das páginas antes da compressão.
const textoDasPaginas = (pdf: ReturnType<typeof montarPdf>) =>
  Array.from({ length: pdf.getNumberOfPages() }, (_, i) => (pdf.internal.pages[i + 1] as unknown as string[]).join("\n"))
const textoCru = (pdf: ReturnType<typeof montarPdf>) => textoDasPaginas(pdf).join("\n")

describe("montarPdf", () => {
  // Capa, Quem somos, Metodologia, Apresentação + escopo, resto do escopo +
  // total, Condições.
  it("gera 6 páginas para a proposta de exemplo", () => {
    expect(montarPdf(docExemplo(), empresaExemplo(), semFonte()).getNumberOfPages()).toBe(6)
  })

  it("escreve valores com centavos, a marca e o rodapé YRM", () => {
    const cru = textoCru(montarPdf(docExemplo(), empresaExemplo(), semFonte()))
    expect(cru).toContain("123.160,00")
    expect(cru).toContain("30.400,00")
    expect(cru).toContain("36.948,00")
    expect(cru).toContain("IEX Projetos")
    expect(cru).toContain("Powered by YRM Strategy Lab")
    expect(cru).toContain("1.400")
    expect(cru).toContain("Credibilidade")
  })

  it("usa o texto de rodapé configurado no lugar do YRM padrão", () => {
    const cru = textoCru(montarPdf(docExemplo(), empresaExemplo({ textoRodape: "Rodapé próprio" }), semFonte()))
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
    const cru = textoCru(montarPdf(doc, empresaExemplo({ dadosBancarios: null }), semFonte()))
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

  const escopoLongo = (n: number, chars: number) =>
    Array.from({ length: n }, (_, i) => `Item ${i + 1} ${"detalhe do escopo ".repeat(Math.ceil(chars / 18))}`.slice(0, chars))

  it("não deixa o título do escopo sozinho quando a primeira disciplina é muito longa", () => {
    // 30 itens de ~120 caracteres quebram em 2 linhas cada: ~60 linhas de
    // 5,1 mm = ~305 mm, mais que uma página (249 mm). A primeira fatia leva o
    // título da seção (13 mm) e o cabeçalho da disciplina no orçamento e
    // enche a página; o restante segue em páginas de continuação.
    const itens = [{ disciplina: "Estrutural", valor: 50000, escopo: escopoLongo(30, 120) }, ...itensExemplo(1)]
    const pdf = montarPdf(docExemplo({ itens, total: 51000 }), empresaExemplo(), semFonte())
    const paginas = textoDasPaginas(pdf)
    const comTitulo = paginas.find((p) => p.includes("Escopo por disciplina"))
    expect(comTitulo).toBeDefined()
    expect(comTitulo).toContain("Estrutural")
    expect(comTitulo).toContain("Item 1 ")
    expect(paginas.join("\n")).toContain("continua")
  })

  it("reproduz o caso do revisor: 22 itens de duas linhas na primeira disciplina", () => {
    const itens = [{ disciplina: "Estrutural", valor: 50000, escopo: escopoLongo(22, 125) }]
    const pdf = montarPdf(docExemplo({ itens, total: 50000 }), empresaExemplo(), semFonte())
    const comTitulo = textoDasPaginas(pdf).find((p) => p.includes("Escopo por disciplina"))
    expect(comTitulo).toContain("Estrutural")
    expect(comTitulo).toContain("Item 1 ")
  })

  it("não deixa a disciplina ultrapassar a página com nome de várias linhas e escopo extenso", () => {
    const disciplina = "Projeto complementar de instalações especiais de gases medicinais, vácuo clínico e ar comprimido hospitalar para centro cirúrgico e UTI"
    const itens = [{ disciplina, valor: 50000, escopo: escopoLongo(40, 120) }, ...itensExemplo(2)]
    const pdf = montarPdf(docExemplo({ itens, total: 52000 }), empresaExemplo(), semFonte())
    const paginas = textoDasPaginas(pdf)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(6)
    expect(pdf.getNumberOfPages()).toBeLessThan(14)
    expect(paginas.join("\n")).toContain("continua")
    expect(paginas.find((p) => p.includes("Escopo por disciplina"))).toContain("Item 1 ")
  })

  describe("textos longos", () => {
    afterEach(() => vi.useRealTimers())
    const ELIPSE = "\u0085" // "…" na codificação WinAnsi do jsPDF

    it("mantém o ano em 'Emitida em' nos meses de nome longo e dia de dois dígitos", () => {
      for (const [mes, nome] of [[8, "setembro"], [10, "novembro"], [11, "dezembro"]] as const) {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, mes, 28, 12))
        const capa = textoDasPaginas(montarPdf(docExemplo(), empresaExemplo(), semFonte()))[0]
        // Uma linha só ou quebrada, mas com o ano completo (o chip da capa tem "/2026").
        expect(capa, nome).toMatch(new RegExp(`\\(28 de ${nome} de 2026\\) Tj|\\(28 de ${nome} de\\) Tj\\s+T\\* \\(2026\\) Tj`))
      }
    })

    it("mostra o nome longo do cliente por inteiro na capa", () => {
      const cliente = "Construtora Colmeia Empreendimentos Imobiliários Ltda"
      const pdf = montarPdf(docExemplo({ cliente }), empresaExemplo(), semFonte())
      const capa = textoDasPaginas(pdf)[0]
      // Linhas quebradas são objetos de texto separados: confere cada palavra.
      for (const palavra of cliente.split(" ")) expect(capa, palavra).toContain(palavra)
      expect(capa).not.toContain(ELIPSE)
      expect(pdf.getNumberOfPages()).toBe(6)
    })

    it("corta com reticências o que não cabe, na capa, na ficha e na assinatura", () => {
      const absurdo = "Construtora Colmeia Empreendimentos Imobiliários e Participações do Nordeste Sociedade Anônima Ltda Matriz Fortaleza"
      const pdf = montarPdf(docExemplo({ cliente: absurdo, contato: absurdo }), empresaExemplo(), semFonte())
      const paginas = textoDasPaginas(pdf)
      expect(paginas[0]).toContain(ELIPSE)
      expect(paginas.find((p) => p.includes("DADOS DO EMPREENDIMENTO") || p.includes("Dados do empreendimento"))).toContain(ELIPSE)
      expect(paginas[paginas.length - 1]).toContain(ELIPSE)
    })

    it("quebra o cargo e o cliente da assinatura em vez de cortar", () => {
      const cargo = "Diretor Comercial e Responsável Técnico pelos Contratos de Projetos Executivos"
      const pdf = montarPdf(docExemplo({ assinaturaCargo: cargo }), empresaExemplo(), semFonte())
      const ultima = textoDasPaginas(pdf).at(-1)!
      for (const palavra of ["Diretor", "Comercial", "Responsável", "Técnico", "Executivos"]) expect(ultima, palavra).toContain(palavra)
      expect(ultima).not.toContain(ELIPSE)
    })

    it("limita o subtítulo da capa a 4 linhas", () => {
      const itens = Array.from({ length: 6 }, (_, i) => ({
        disciplina: `Projeto de instalações especiais de gases medicinais, vácuo clínico e ar comprimido hospitalar ${i + 1}`,
        valor: 1000,
        escopo: ["Item."],
      }))
      const capa = textoDasPaginas(montarPdf(docExemplo({ itens, total: 6000 }), empresaExemplo(), semFonte()))[0]
      // A linha com "Projetos executivos de" e as seguintes até o bloco "CLIENTE".
      const inicio = capa.indexOf("(Projetos executivos de")
      const fim = capa.indexOf("(CLIENTE)")
      const linhasSub = capa.slice(inicio, fim).match(/\) Tj/g) ?? []
      expect(linhasSub.length).toBeLessThanOrEqual(4)
      expect(capa.slice(inicio, fim)).toContain(ELIPSE)
    })

    it("com 18 disciplinas o subtítulo resume o resto", () => {
      const itens = itensExemplo(18)
      const capa = textoDasPaginas(montarPdf(docExemplo({ itens, total: 171000 }), empresaExemplo(), semFonte()))[0]
      expect(capa).toContain("e mais 13 disciplinas.")
    })
  })
})
