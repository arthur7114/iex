"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { registrarLogSeguro } from "@/lib/db/logs"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get("redirect") || "/"

  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) {
        // 400/401 indicam credenciais inválidas; demais códigos, uma falha inesperada.
        setErro(
          error.status === 400 || error.status === 401
            ? "E-mail ou senha inválidos."
            : "Não foi possível entrar agora. Tente novamente em instantes.",
        )
        setLoading(false)
        return
      }
      // Registra o login na auditoria (PRD 001). Não bloqueia o acesso se falhar.
      await registrarLogSeguro("Login", {
        entidade: "Sessão",
        detalhe: "Autenticação realizada com sucesso",
      })
      router.push(redirectTo)
      router.refresh()
    } catch {
      setErro("Não foi possível conectar. Verifique sua conexão e tente novamente.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">IEX</h1>
          <p className="text-sm text-muted-foreground">Gestor de Propostas</p>
        </div>

        <Card className="space-y-5 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Entrar</h2>
            <p className="text-sm text-muted-foreground">Acesse com suas credenciais corporativas.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@iexprojetos.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {erro && (
              <p role="alert" className="text-sm text-danger">
                {erro}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">Powered by YRM Strategy Lab</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
