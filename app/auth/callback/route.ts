import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

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

function destinoSeguro(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/"
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const validacao = callbackSchema.safeParse(Object.fromEntries(url.searchParams))

  if (validacao.success) {
    const next = destinoSeguro(validacao.data.next ?? null)
    const supabase = await createClient()
    const { error } =
      "code" in validacao.data
        ? await supabase.auth.exchangeCodeForSession(validacao.data.code)
        : await supabase.auth.verifyOtp({
            token_hash: validacao.data.token_hash,
            type: validacao.data.type,
          })
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }

  const erro = new URL("/login", url.origin)
  erro.searchParams.set("erro", "link-invalido")
  return NextResponse.redirect(erro)
}
