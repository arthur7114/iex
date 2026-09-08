"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CircleAlert, Loader2, MailCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { registrarLogSeguro } from "@/lib/db/logs"
import { solicitarRedefinicaoSenha } from "@/lib/actions/senha"
import { destinoInternoSeguro } from "@/lib/auth/destino"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Avisos que chegam por querystring de outras rotas (callback de link e
// middleware). Sem isto a tela ficava muda: o usuário clicava num link expirado,
// era redirecionado para cá e não via explicação nenhuma.
const AVISOS: Record<string, { titulo: string; descricao: string }> = {
  "link-invalido": {
    titulo: "Link inválido ou expirado",
    descricao: "Este link de acesso já foi usado ou perdeu a validade. Solicite um novo abaixo.",
  },
  bloqueado: {
    titulo: "Acesso desativado",
    descricao: "Seu acesso à plataforma foi desativado. Fale com um administrador da equipe.",
  },
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  // Só aceita destino interno (mesma origem): evita open redirect via
  // ?redirect=https://evil.com, //evil.com ou /\evil.com em cadeias de phishing.
  const redirectTo = destinoInternoSeguro(params.get("redirect"))

  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // "login" → formulário normal; "recuperar" → pedir link; "enviado" → confirmação.
  const [modo, setModo] = useState<"login" | "recuperar" | "enviado">("login")
  const [enviandoLink, setEnviandoLink] = useState(false)

  const aviso = AVISOS[params.get("erro") ?? ""] ?? (params.get("bloqueado") ? AVISOS.bloqueado : null)

  async function pedirRedefinicao(e: React.FormEvent) {
    e.preventDefault()
    setEnviandoLink(true)
    try {
      await solicitarRedefinicaoSenha(email)
    } catch {
      // A action nunca falha por e-mail inexistente; um erro aqui é de rede.
      // A confirmação é neutra de propósito, então seguimos para ela do mesmo jeito.
    }
    setEnviandoLink(false)
    setModo("enviado")
  }

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

        {aviso && (
          <Alert variant="destructive">
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>{aviso.titulo}</AlertTitle>
            <AlertDescription>{aviso.descricao}</AlertDescription>
          </Alert>
        )}

        {modo === "enviado" ? (
          <Card className="space-y-5 p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <MailCheck className="h-5 w-5 text-primary" aria-hidden />
              </span>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Verifique seu e-mail</h2>
                {/* Resposta neutra de propósito: não confirma se o e-mail tem conta. */}
                <p className="text-sm text-muted-foreground">
                  Se <span className="font-medium text-foreground">{email}</span> estiver cadastrado, enviamos um
                  link para você criar uma nova senha. O link vale por tempo limitado.
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setModo("login")}>
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </Button>
          </Card>
        ) : modo === "recuperar" ? (
          <Card className="space-y-5 p-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Redefinir senha</h2>
              <p className="text-sm text-muted-foreground">
                Informe seu e-mail corporativo e enviaremos um link para cadastrar uma nova senha.
              </p>
            </div>

            <form onSubmit={pedirRedefinicao} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email-recuperacao">E-mail</Label>
                <Input
                  id="email-recuperacao"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@iexprojetos.com"
                />
              </div>

              <Button type="submit" className="w-full" disabled={enviandoLink}>
                {enviandoLink && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                Enviar link de redefinição
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setModo("login")}
                disabled={enviandoLink}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o login
              </Button>
            </form>
          </Card>
        ) : (
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
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="senha">Senha</Label>
                  <button
                    type="button"
                    className="rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      setErro(null)
                      setModo("recuperar")
                    }}
                  >
                    Esqueci minha senha
                  </button>
                </div>
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
        )}

        <p className="text-center text-xs text-muted-foreground">Powered by YRM Strategy Lab</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
