"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { atualizarMeuPerfil } from "@/lib/actions/perfil"
import { CARGO_SIGNATARIO_PADRAO } from "@/lib/document/tipos"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UsuarioAtual } from "@/lib/db/types"

// Edição do próprio perfil: nome e cargo. O cargo é o texto impresso sob a
// assinatura das propostas — até aqui ele era fixo no código.
export function PerfilDialog({
  usuario,
  open,
  onOpenChange,
  onSalvo,
}: {
  usuario: UsuarioAtual
  open: boolean
  onOpenChange: (open: boolean) => void
  onSalvo: (perfil: { nome: string; cargo: string | null }) => void
}) {
  const [nome, setNome] = useState(usuario.nome)
  const [cargo, setCargo] = useState(usuario.cargo ?? "")
  const [salvando, setSalvando] = useState(false)

  // Reabrir o diálogo descarta edições não salvas e volta ao perfil vigente.
  useEffect(() => {
    if (open) {
      setNome(usuario.nome)
      setCargo(usuario.cargo ?? "")
    }
  }, [open, usuario.nome, usuario.cargo])

  async function salvar(event: React.FormEvent) {
    event.preventDefault()
    if (!nome.trim()) {
      toast.error("Informe o seu nome.")
      return
    }
    setSalvando(true)
    try {
      const res = await atualizarMeuPerfil({ nome: nome.trim(), cargo: cargo.trim() })
      if (!res.ok || !res.perfil) {
        toast.error(res.error ?? "Não foi possível salvar o perfil.")
        return
      }
      onSalvo(res.perfil)
      toast.success("Perfil atualizado.")
      onOpenChange(false)
    } catch {
      toast.error("Não foi possível salvar o perfil.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !salvando && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={salvar}>
          <DialogHeader>
            <DialogTitle>Meu perfil</DialogTitle>
            <DialogDescription>
              Como você aparece na plataforma e na assinatura das propostas que gerar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="perfil-nome">Nome</Label>
              <Input
                id="perfil-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="perfil-cargo">Cargo</Label>
              <Input
                id="perfil-cargo"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder={CARGO_SIGNATARIO_PADRAO}
                maxLength={60}
                aria-describedby="perfil-cargo-ajuda"
              />
              <p id="perfil-cargo-ajuda" className="text-xs text-muted-foreground">
                Aparece sob a sua assinatura nas propostas. Em branco, usamos “{CARGO_SIGNATARIO_PADRAO}”.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground">E-mail</Label>
              <p className="text-sm text-muted-foreground">{usuario.email ?? "—"}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Permissão de acesso</Label>
              <p className="text-sm text-muted-foreground">
                {usuario.funcao} · alterada por um administrador em Configurações → Equipe.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
