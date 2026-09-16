import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { destinoInternoSeguro } from "@/lib/auth/destino"
import { resolverOrigem } from "@/lib/auth/origem"

const callbackSchema = z.union([
  z.object({
    code: z.string().trim().min(1),
    next: z.string().optional(),
  }),
  z.object({
    token_hash: z.string().trim().min(1),
    type: z.enum(["email", "invite", "magiclink", "recovery", "signup", "email_change"]),
    next: z.string().optional(),
  }),
])

export async function GET(request: Request) {
  const url = new URL(request.url)
  // Atrás de proxy reverso, `url.origin` é o host interno do container. Todo
  // redirecionamento daqui precisa sair na origem pública — é ela que o usuário
  // tem aberta no navegador.
  const origem = (await resolverOrigem()) || url.origin
  const validacao = callbackSchema.safeParse(Object.fromEntries(url.searchParams))

  if (validacao.success) {
    const next = destinoInternoSeguro(validacao.data.next, origem)
    const supabase = await createClient()
    const { error } =
      "code" in validacao.data
        ? await supabase.auth.exchangeCodeForSession(validacao.data.code)
        : await supabase.auth.verifyOtp({
            token_hash: validacao.data.token_hash,
            type: validacao.data.type,
          })
    if (!error) return NextResponse.redirect(new URL(next, origem))
  }

  const erro = new URL("/login", origem)
  erro.searchParams.set("erro", "link-invalido")
  return NextResponse.redirect(erro)
}
