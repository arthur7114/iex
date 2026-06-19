import { createBrowserClient } from "@supabase/ssr"

// Cliente Supabase para uso no browser (client components).
// Usa a publishable/anon key e a sessão em cookies (compartilhada com o middleware).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
