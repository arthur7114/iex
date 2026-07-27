"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function DefinirSenhaPage() {
  const router = useRouter()
  const [senha, setSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(event: React.FormEvent) {
    event.preventDefault()
    setErro(null)
    if (senha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres.")
      return
    }
    if (senha !== confirmacao) {
      setErro("As senhas informadas não coincidem.")
      return
    }

    setSalvando(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setErro("O link expirou ou não foi possível definir a senha. Solicite um novo acesso.")
      setSalvando(false)
      return
    }
    router.replace("/")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm space-y-5 p-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">Definir senha</h1>
          <p className="text-sm text-muted-foreground">
            Crie a senha que será usada no acesso à plataforma IEX.
          </p>
        </div>
        <form className="space-y-4" onSubmit={salvar}>
          <div className="space-y-1.5">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <Input
              id="nova-senha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmar-senha">Confirmar senha</Label>
            <Input
              id="confirmar-senha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
            />
          </div>
          {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
          <Button type="submit" className="w-full" disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar senha
          </Button>
        </form>
      </Card>
    </div>
  )
}
