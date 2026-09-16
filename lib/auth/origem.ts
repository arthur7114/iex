import "server-only"

import { headers } from "next/headers"

// Resolve a URL pública da aplicação.
//
// Atrás de um proxy reverso (EasyPanel/Traefik, entre outros), `request.url`
// carrega o host INTERNO do container — na prática "localhost:80". Redirecionar
// com `url.origin` manda o usuário para um endereço que só existe dentro da
// máquina, e o link de acesso morre em ERR_CONNECTION_REFUSED no navegador dele.
//
// A ordem abaixo prefere o que foi declarado explicitamente e só depois recorre
// aos cabeçalhos que o proxy repassa; `host` fica por último justamente porque é
// ele que carrega o endereço interno.
export async function resolverOrigem(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/$/, "")

  const h = await headers()

  const hostEncaminhado = h.get("x-forwarded-host")
  if (hostEncaminhado) {
    const proto = h.get("x-forwarded-proto") ?? "https"
    return `${proto}://${hostEncaminhado}`
  }

  const origin = h.get("origin")
  if (origin) return origin

  const host = h.get("host")
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
    return `${proto}://${host}`
  }

  return ""
}
