"use client"

import { useState } from "react"
import { Paperclip, FileText, Send, CheckCircle2, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function EmailComposer({
  destinatarioInicial,
  numero,
  empreendimento,
  onEnviar,
}: {
  destinatarioInicial: string
  numero: string
  empreendimento: string
  onEnviar: (dados: { destinatario: string; copias: string; assunto: string; corpo: string; anexo: "pdf" | "word" }) => void | Promise<void>
}) {
  const [destinatario, setDestinatario] = useState(destinatarioInicial)
  const [copias, setCopias] = useState("")
  const [assunto, setAssunto] = useState(`Proposta comercial ${numero} — ${empreendimento}`)
  const [corpo, setCorpo] = useState(
    `Prezados,\n\nSegue em anexo a proposta comercial referente ao empreendimento ${empreendimento}.\n\nPermanecemos à disposição para esclarecimentos e ajustes que se façam necessários.\n\nAtenciosamente,\nIEX Engenharia`,
  )
  const [anexo, setAnexo] = useState<"pdf" | "word">("pdf")
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function handleClick() {
    setEnviando(true)
    try {
      await onEnviar({ destinatario, copias, assunto, corpo, anexo })
      setEnviado(true)
    } catch {
      // o chamador exibe o erro via toast
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive/15 text-[oklch(0.45_0.1_155)]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Proposta enviada com sucesso</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            O status foi alterado para <strong className="text-foreground">Enviada / aguardando retorno</strong> e o
            envio foi registrado no log de auditoria.
          </p>
        </div>
        <div className="mt-2 rounded-md border border-border bg-secondary/50 px-4 py-2 text-left text-xs text-muted-foreground">
          Para: {destinatario} · Anexo: proposta-{numero}.{anexo === "pdf" ? "pdf" : "docx"}
        </div>
      </Card>
    )
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dest">Destinatário</Label>
          <Input id="dest" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cc">Cópias (CC)</Label>
          <Input id="cc" value={copias} onChange={(e) => setCopias(e.target.value)} placeholder="opcional" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assunto">Assunto</Label>
        <Input id="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="corpo">Corpo do e-mail</Label>
        <Textarea id="corpo" value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={8} />
      </div>

      <div className="space-y-1.5">
        <Label>Anexo</Label>
        <div className="flex gap-2">
          {(["pdf", "word"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setAnexo(t)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                anexo === t
                  ? "border-primary bg-secondary text-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary/50",
              )}
            >
              <FileText className="h-4 w-4" />
              proposta-{numero}.{t === "pdf" ? "pdf" : "docx"}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <Paperclip className="h-3 w-3" /> 1 anexo selecionado
        </p>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={handleClick} disabled={enviando || !destinatario}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {enviando ? "Enviando…" : "Enviar proposta"}
        </Button>
      </div>
    </Card>
  )
}
