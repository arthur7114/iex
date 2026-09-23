import { describe, expect, it } from "vitest"
import { brl, type PropostaDoc } from "@/lib/document/tipos"
import { escaparHtml, textoParaHtml } from "./html"
import {
  ASSUNTO_PADRAO,
  CORPO_PADRAO,
  modeloEfetivo,
  renderizarModelo,
  tokensDesconhecidos,
  valoresDaProposta,
} from "./modelo"

const doc: PropostaDoc = {
  numero: "20260923-01",
  versao: 2,
  apresentacao: "",
  cliente: "Construtora Alfa",
  contato: "Maria Souza",
  empreendimento: "Residencial Aurora",
  cidade: "Recife",
  uf: "PE",
  area: 1000,
  tipo: "Residencial",
  itens: [],
  total: 48500,
  formaPagamento: "",
  prazoExecucao: "60 dias",
  validade: "30 dias",
  premissas: [],
  exclusoes: [],
  observacoes: "",
  responsavel: "Arthur Brito",
}

describe("renderizarModelo", () => {
  it("substitui variáveis conhecidas, tolerando espaços internos", () => {
    expect(renderizarModelo("Olá {{contato}}, {{ cliente }}!", { contato: "Maria", cliente: "Alfa" })).toBe(
      "Olá Maria, Alfa!",
    )
  })

  it("variável conhecida sem valor vira vazio", () => {
    expect(renderizarModelo("[{{cidade}}]", {})).toBe("[]")
  })

  it("variável desconhecida fica como está", () => {
    expect(renderizarModelo("Oi {{apelido}} {{Cliente}}", { cliente: "Alfa" })).toBe("Oi {{apelido}} {{Cliente}}")
  })
})

describe("tokensDesconhecidos", () => {
  it("lista tokens desconhecidos sem repetir", () => {
    expect(tokensDesconhecidos("{{cliente}} {{xyz}} {{ xyz }} {{Nome}}")).toEqual(["xyz", "Nome"])
  })

  it("devolve vazio quando só há conhecidos", () => {
    expect(tokensDesconhecidos(CORPO_PADRAO + ASSUNTO_PADRAO)).toEqual([])
  })
})

describe("modeloEfetivo", () => {
  it("usa o padrão quando o campo está nulo ou em branco", () => {
    expect(modeloEfetivo({ assunto: null, corpo: "   " })).toEqual({ assunto: ASSUNTO_PADRAO, corpo: CORPO_PADRAO })
  })

  it("mantém o texto configurado", () => {
    expect(modeloEfetivo({ assunto: "A", corpo: "B" })).toEqual({ assunto: "A", corpo: "B" })
  })
})

describe("valoresDaProposta", () => {
  it("mapeia documento, empresa e remetente", () => {
    const v = valoresDaProposta(doc, { razaoSocial: "IEX Engenharia" }, { nome: "Arthur", cargo: null })
    expect(v).toMatchObject({
      cliente: "Construtora Alfa",
      contato: "Maria Souza",
      empreendimento: "Residencial Aurora",
      numero: "20260923-01 · V2",
      cidade: "Recife",
      uf: "PE",
      valor_total: brl(48500),
      validade: "30 dias",
      prazo: "60 dias",
      empresa: "IEX Engenharia",
      remetente_nome: "Arthur",
      remetente_cargo: "",
    })
  })

  it("reproduz o assunto padrão de antes", () => {
    const v = valoresDaProposta(doc, { razaoSocial: "IEX" }, { nome: "A", cargo: null })
    expect(renderizarModelo(ASSUNTO_PADRAO, v)).toBe("Proposta comercial 20260923-01 · V2 — Residencial Aurora")
  })
})

describe("html", () => {
  it("escapa os cinco caracteres especiais", () => {
    expect(escaparHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;")
  })

  it("converte quebras de linha em <br> depois de escapar", () => {
    expect(textoParaHtml("a<b\r\nc\nd")).toBe("a&lt;b<br>c<br>d")
  })
})
