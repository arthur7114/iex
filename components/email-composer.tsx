"use client"

import { useState } from "react"
import { Paperclip, FileText, Send, CheckCircle2, Loader2, FlaskConical, AlertTriangle, RotateCcw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

// Resultado real do envio, vindo da server action (lib/actions/email.ts).
export interface ResultadoEnvio {
  ok: boolean
  simulado: boolean
  error?: string
}

type Estado = "idle" | "enviando" | "enviado" | "simulado" | "falhou"

export function EmailComposer({
  destinatarioInicial,
  numero,
  empreendimento,
  onEnviar,
}: {
  destinatarioInicial: string
  numero: string
  empreendimento: string
  onEnviar: (dados: {
    destinatario: string
    copias: string
    assunto: string
    corpo: string
    anexo: "pdf" | "word"
  }) => Promise<ResultadoEnvio>
}) {
  const [destinatario, setDestinatario] = useState(destinatarioInicial)
  const [copias, setCopias] = useState("")
  const [assunto, setAssunto] = useState(`Proposta comercial ${numero} — ${empreendimento}`)
  const [corpo, setCorpo] = useState(
    `Prezados,\n\nSegue em anexo a proposta comercial referente ao empreendimento ${empreendimento}.\n\nPermanecemos à disposição para esclarecimentos e ajustes que se façam necessários.\n\nAtenciosamente,\nIEX Engenharia`,
  )
  const [anexo, setAnexo] = useState<"pdf" | "word">("pdf")
  const [estado, setEstado] = useState<Estado>("idle")
  const [erro, setErro] = useState<string>("")

  const enviando = estado === "enviando"
  const nomeAnexo = `proposta-${numero}.${anexo === "pdf" ? "pdf" : "docx"}`

  async function handleEnviar() {
    setEstado("enviando")
    setErro("")
    try {
      const res = await onEnviar({ destinatario, copias, assunto, corpo, anexo })
      if (res.ok && !res.simulado) setEstado("enviado")
      else if (res.ok && res.simulado) setEstado("simulado")
      else {
        setErro(res.error || "Não foi possível enviar o e-mail. Tente novamente.")
        setEstado("falhou")
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado ao enviar o e-mail.")
      setEstado("falhou")
    }
  }

  // Envio real concluído — único caso que altera o status para "Enviada".
  if (estado === "enviado") {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive/15 text-[oklch(0.42_0.11_155)]">
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
          Para: {destinatario} · Anexo: {nomeAnexo}
        </div>
      </Card>
    )
  }

  // Envio simulado — provedor não configurado. NÃO é sucesso e NÃO altera status.
  if (estado === "simulado") {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-[oklch(0.45_0.13_75)]">
          <FlaskConical className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Envio simulado — nada foi enviado</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            O provedor de e-mail não está configurado, então nenhuma mensagem foi enviada de verdade. O status da
            proposta <strong className="text-foreground">permanece inalterado</strong>. Para envio real, configure a
            variável <code className="rounded bg-secondary px-1 py-0.5 text-[12px]">RESEND_API_KEY</code>.
          </p>
        </div>
        <div className="mt-2 rounded-md border border-border bg-secondary/50 px-4 py-2 text-left text-xs text-muted-foreground">
          Simulado para: {destinatario} · Anexo: {nomeAnexo}
        </div>
        <Button variant="outline" size="sm" className="mt-1" onClick={() => setEstado("idle")}>
          Voltar ao formulário
        </Button>
      </Card>
    )
  }

  return (
    <Card className="space-y-4 p-6">
      {estado === "falhou" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha no envio</AlertTitle>
          <AlertDescription>
            <p>{erro}</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dest">Destinatário</Label>
          <Input id="dest" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} disabled={enviando} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cc">Cópias (CC)</Label>
          <Input id="cc" value={copias} onChange={(e) => setCopias(e.target.value)} placeholder="opcional" disabled={enviando} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assunto">Assunto</Label>
        <Input id="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} disabled={enviando} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="corpo">Corpo do e-mail</Label>
        <Textarea id="corpo" value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={8} disabled={enviando} />
      </div>

      <div className="space-y-1.5">
        <Label>Anexo</Label>
        <div className="flex gap-2">
          {(["pdf", "word"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAnexo(t)}
              disabled={enviando}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-60",
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
        <Button onClick={handleEnviar} disabled={enviando || !destinatario}>
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : estado === "falhou" ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {enviando ? "Enviando…" : estado === "falhou" ? "Tentar novamente" : "Enviar proposta"}
        </Button>
      </div>
    </Card>
  )
}
