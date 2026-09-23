"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { uploadImagemAssinatura, type MinhaAssinatura } from "@/lib/actions/assinatura"
import type { ModoAssinatura } from "@/lib/email/assinatura"

// Campos da assinatura de e-mail (controlado pelo PerfilDialog, que salva junto
// com nome e cargo). Upload sobe na hora; o caminho só vale depois de salvar.
export function AssinaturaEmailForm({
  valor,
  onChange,
  desabilitado,
}: {
  valor: MinhaAssinatura
  onChange: (v: MinhaAssinatura) => void
  desabilitado?: boolean
}) {
  const [enviando, setEnviando] = useState<"foto" | "imagem" | null>(null)
  const fotoInput = useRef<HTMLInputElement>(null)
  const imagemInput = useRef<HTMLInputElement>(null)

  async function subir(tipo: "foto" | "imagem", file: File | undefined) {
    if (!file) return
    setEnviando(tipo)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadImagemAssinatura(tipo, fd)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      onChange(
        tipo === "foto"
          ? { ...valor, fotoPath: res.path, fotoUrl: res.url }
          : { ...valor, imagemPath: res.path, imagemUrl: res.url },
      )
    } catch {
      toast.error("Não foi possível enviar a imagem.")
    } finally {
      setEnviando(null)
    }
  }

  const modos: { id: ModoAssinatura; rotulo: string }[] = [
    { id: "html", rotulo: "Montada" },
    { id: "imagem", rotulo: "Imagem" },
  ]

  return (
    <div className="space-y-3">
      <div>
        <Label>Assinatura de e-mail</Label>
        <p className="text-xs text-muted-foreground">Vai no fim de toda proposta que você enviar.</p>
      </div>

      <div className="flex gap-2" role="radiogroup" aria-label="Tipo de assinatura">
        {modos.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={valor.modo === m.id}
            disabled={desabilitado}
            onClick={() => onChange({ ...valor, modo: m.id })}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-60",
              valor.modo === m.id
                ? "border-primary bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:bg-secondary/50",
            )}
          >
            {m.rotulo}
          </button>
        ))}
      </div>

      {valor.modo === "html" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {valor.fotoUrl ? (
              <img src={valor.fotoUrl} alt="" className="h-12 w-12 rounded-full border border-border object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-full border border-dashed border-border" />
            )}
            <input
              ref={fotoInput}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => subir("foto", e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={desabilitado || enviando !== null}
              onClick={() => fotoInput.current?.click()}
            >
              {enviando === "foto" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {valor.fotoUrl ? "Trocar foto" : "Enviar foto"}
            </Button>
            {valor.fotoPath && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={desabilitado}
                onClick={() => onChange({ ...valor, fotoPath: null, fotoUrl: null })}
                aria-label="Remover foto"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assinatura-telefone">Telefone</Label>
              <Input
                id="assinatura-telefone"
                value={valor.telefone}
                onChange={(e) => onChange({ ...valor, telefone: e.target.value })}
                placeholder="(81) 99999-0000"
                maxLength={40}
                disabled={desabilitado}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assinatura-email">E-mail de contato</Label>
              <Input
                id="assinatura-email"
                type="email"
                value={valor.email}
                onChange={(e) => onChange({ ...valor, email: e.target.value })}
                placeholder={valor.emailLogin}
                maxLength={120}
                disabled={desabilitado}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Nome e cargo vêm dos campos acima; logo e cor, da Identidade visual da empresa. As respostas do cliente
            vão para o e-mail de contato.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {valor.imagemUrl && (
            <img src={valor.imagemUrl} alt="Assinatura" className="max-h-32 max-w-full rounded border border-border" />
          )}
          <input
            ref={imagemInput}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => subir("imagem", e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={desabilitado || enviando !== null}
            onClick={() => imagemInput.current?.click()}
          >
            {enviando === "imagem" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {valor.imagemUrl ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          <p className="text-xs text-muted-foreground">
            PNG ou JPG até 500 KB, exibida com até 600px de largura. Sem imagem, usamos a assinatura montada.
          </p>
        </div>
      )}
    </div>
  )
}
