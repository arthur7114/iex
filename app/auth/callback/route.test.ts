import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

const exchangeCodeForSession = vi.fn()
const verifyOtp = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, verifyOtp } }),
}))


const ORIGEM = "https://app.iexprojetos.com"
const SEM_ERRO = { error: null }
const COM_ERRO = { error: { message: "invalid flow state" } }

// Executa o handler como o Next executa: uma Request nua, sem servidor.
async function chamar(query: string): Promise<{ status: number; destino: string }> {
  const res = await GET(new Request(`${ORIGEM}/auth/callback${query}`))
  return { status: res.status, destino: res.headers.get("location") ?? "" }
}

const LINK_INVALIDO = `${ORIGEM}/login?erro=link-invalido`

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue(SEM_ERRO)
  verifyOtp.mockReset().mockResolvedValue(SEM_ERRO)
})

describe("GET /auth/callback", () => {
  describe("fluxo PKCE (code)", () => {
    it("troca o código pela sessão e cai no destino pedido", async () => {
      const { status, destino } = await chamar("?code=abc123&next=/definir-senha")

      expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123")
      expect(verifyOtp).not.toHaveBeenCalled()
      expect(status).toBe(307)
      expect(destino).toBe(`${ORIGEM}/definir-senha`)
    })

    it("sem `next`, manda para a raiz", async () => {
      const { destino } = await chamar("?code=abc123")

      expect(destino).toBe(`${ORIGEM}/`)
    })

    it("manda para o login quando a troca falha", async () => {
      exchangeCodeForSession.mockResolvedValue(COM_ERRO)

      const { destino } = await chamar("?code=expirado&next=/definir-senha")

      expect(destino).toBe(LINK_INVALIDO)
    })
  })

  describe("fluxo de token_hash (convite e recuperação)", () => {
    it("verifica o OTP de recuperação e leva a /definir-senha", async () => {
      const { destino } = await chamar("?token_hash=hash-abc&type=recovery&next=/definir-senha")

      expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-abc", type: "recovery" })
      expect(exchangeCodeForSession).not.toHaveBeenCalled()
      expect(destino).toBe(`${ORIGEM}/definir-senha`)
    })

    it("aceita também o convite", async () => {
      const { destino } = await chamar("?token_hash=hash-abc&type=invite&next=/definir-senha")

      expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-abc", type: "invite" })
      expect(destino).toBe(`${ORIGEM}/definir-senha`)
    })

    it("manda para o login quando o token não confere", async () => {
      verifyOtp.mockResolvedValue(COM_ERRO)

      const { destino } = await chamar("?token_hash=queimado&type=recovery")

      expect(destino).toBe(LINK_INVALIDO)
    })
  })

  describe("entradas inválidas", () => {
    // Cada caso chega ao login com o mesmo aviso e sem tocar no Supabase.
    it.each([
      ["sem nenhum parâmetro", ""],
      ["com o código vazio", "?code="],
      ["com o token vazio", "?token_hash=&type=recovery"],
      ["com um tipo que não existe", "?token_hash=hash-abc&type=sequestro"],
      ["com token sem tipo", "?token_hash=hash-abc"],
      ["com tipo sem token", "?type=recovery"],
    ])("recusa o acesso %s", async (_caso, query) => {
      const { destino } = await chamar(query)

      expect(destino).toBe(LINK_INVALIDO)
      expect(exchangeCodeForSession).not.toHaveBeenCalled()
      expect(verifyOtp).not.toHaveBeenCalled()
    })
  })

  describe("proteção contra redirecionamento externo", () => {
    // O link chega por e-mail: quem monta a URL controla `next`. Um destino
    // externo transformaria o callback numa etapa de phishing com sessão válida.
    it.each([
      ["URL absoluta", "https://evil.com/colher-senha"],
      ["protocolo relativo", "//evil.com"],
      ["barra invertida", "/\\evil.com"],
      ["barra invertida dupla", "/\\/evil.com"],
      ["esquema javascript", "javascript:alert(1)"],
      ["destino sem barra inicial", "definir-senha"],
    ])("ignora %s e usa a raiz", async (_caso, next) => {
      const { destino } = await chamar(`?code=abc123&next=${encodeURIComponent(next)}`)

      expect(destino).toBe(`${ORIGEM}/`)
    })

    it("preserva query e fragmento de um destino interno", async () => {
      const { destino } = await chamar(`?code=abc123&next=${encodeURIComponent("/propostas?status=Enviada#topo")}`)

      expect(destino).toBe(`${ORIGEM}/propostas?status=Enviada#topo`)
    })
  })
})
