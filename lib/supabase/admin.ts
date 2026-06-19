import "server-only"
import { createClient } from "@supabase/supabase-js"

// Cliente Supabase com service_role — SOMENTE no servidor (server actions / route handlers).
// Bypassa RLS; usar apenas para operações administrativas (criar usuários, e-mail, etc.).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
