import { beforeEach, describe, expect, it, vi } from "vitest"

// vi.mock é içado acima dos imports: o que a fábrica usa precisa vir de vi.hoisted.
const { enviarEmail, inserts } = vi.hoisted(() => ({
  enviarEmail: vi.fn(async (_msg: unknown) => "<msg-id>"),
  inserts: [] as { tabela: string; row: Record<string, unknown> }[],
}))

vi.mock("@/lib/email/smtp", () => ({
  smtpConfigurado: () => true,
  enviarEmail,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push({ tabela, row })
        return { error: null }
      },
    }),
  }),
}))
vi.mock("./_auth", () => ({
  exigirSessao: async () => ({
    ok: true,
    user: { authUserId: "a1", usuarioId: "u1", nome: "Arthur", email: "login@iex.com", funcao: "Editor" },
  }),
}))
vi.mock("@/lib/email/contexto", () => ({
  carregarContextoEnvio: async () => ({
    modelo: { assunto: "Proposta {{numero}} para {{cliente}}", corpo: null },
    marca: { razaoSocial: "IEX Engenharia", logoPath: "logo/1.png", corPrimaria: null },
    assinatura: {
      modo: "html",
      nome: "Arthur",
      cargo: "Diretor",
      telefone: null,
      email: "arthur@iex.com",
      fotoPath: null,
      imagemPath: null,
    },
    cargo: "Diretor",
  }),
  urlPublicaBranding: (p: string) => `https://cdn/${p}`,
  baixarImagensInline: async () => ({
    anexos: [{ nome: "assinatura-logo.png", base64: "AAA", mime: "image/png", cid: "assinatura-logo" }],
    falhas: [],
  }),
}))

import { enviarProposta, prepararEmailProposta } from "./email"

beforeEach(() => {
  enviarEmail.mockClear()
  inserts.length = 0
})

describe("enviarProposta", () => {
  it("envia texto + HTML com assinatura, imagem inline, anexo e replyTo", async () => {
    const r = await enviarProposta({
      propostaId: "p1",
      destinatario: "cliente@x.com",
      assunto: "Assunto",
      corpo: "Olá <Maria>",
      anexoTipo: "pdf",
      anexoNome: "p.pdf",
      anexoBase64: "PDF",
    })
    expect(r).toEqual({ ok: true, simulado: false, providerId: "<msg-id>" })
    const msg = enviarEmail.mock.calls[0][0] as Record<string, unknown>
    expect(msg.replyTo).toBe("arthur@iex.com")
    expect(msg.texto).toBe("Olá <Maria>\n\n--\nArthur\nDiretor\narthur@iex.com\nIEX Engenharia")
    expect(msg.html).toContain("Olá &lt;Maria&gt;")
    expect(msg.html).toContain('src="cid:assinatura-logo"')
    expect(msg.anexos).toEqual([
      { nome: "assinatura-logo.png", base64: "AAA", mime: "image/png", cid: "assinatura-logo" },
      { nome: "p.pdf", base64: "PDF", mime: "application/pdf" },
    ])
    const envio = inserts.find((i) => i.tabela === "envios_email")!
    expect(envio.row.corpo).toBe("Olá <Maria>")
  })
})

describe("prepararEmailProposta", () => {
  it("renderiza o modelo com os dados da proposta e a prévia da assinatura", async () => {
    const r = await prepararEmailProposta({
      numero: "20260923-01",
      versao: 1,
      apresentacao: "",
      cliente: "Alfa",
      contato: "Maria",
      empreendimento: "Aurora",
      cidade: "Recife",
      uf: "PE",
      area: 0,
      tipo: "",
      itens: [],
      total: 0,
      formaPagamento: "",
      prazoExecucao: "",
      validade: "",
      premissas: [],
      exclusoes: [],
      observacoes: "",
      responsavel: "Arthur",
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.assunto).toBe("Proposta 20260923-01 · V1 para Alfa")
    expect(r.corpo).toContain("empreendimento Aurora.")
    expect(r.corpo.endsWith("IEX Engenharia")).toBe(true)
    expect(r.assinaturaHtml).toContain('src="https://cdn/logo/1.png"')
  })
})
