import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Rotas públicas (não exigem sessão).
const PUBLIC_PATHS = ["/login", "/auth"]

// Renova a sessão do Supabase e protege rotas privadas.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANTE: não rodar código entre createServerClient e getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // Desativação bloqueia acesso: encerra sessões vigentes de membros marcados
  // como inativos (o ban no Auth impede novos logins/refresh; esta checagem
  // corta sessões que ainda tenham token válido). Aditivo e restrito a rotas
  // privadas para não custar em /login e /auth.
  if (user && !isPublic) {
    const { data: perfil } = await supabase
      .from("usuarios")
      .select("ativo")
      .eq("auth_user_id", user.id)
      .maybeSingle()
    if (perfil && perfil.ativo === false) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.search = ""
      url.searchParams.set("bloqueado", "1")
      return NextResponse.redirect(url)
    }
  }

  // Já autenticado tentando acessar /login → manda para o dashboard.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
