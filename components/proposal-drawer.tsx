"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, MapPin, Layers, TrendingDown, TrendingUp, Download } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { formatBRL, formatDate } from "@/lib/mock-data"
import { transicionarStatus } from "@/lib/db/propostas"
import { listarOpcoes } from "@/lib/db/lookups"
import type { Proposta, StatusProposta } from "@/lib/db/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { montarDocumento } from "@/lib/document/montar"
import { gerarPdf } from "@/lib/document/pdf"
import { gerarWord } from "@/lib/document/word"
import { baixarBlob } from "@/lib/document/util"

const statusOptions: StatusProposta[] = ["Em elaboração", "Enviada", "Aprovada", "Perdida"]

export function ProposalDrawer({
  proposta,
  open,
  onOpenChange,
  onStatusChanged,
}: {
  proposta: Proposta | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChanged?: () => void
}) {
  const router = useRouter()
  const [novoStatus, setNovoStatus] = useState<StatusProposta | "">("")
  const [motivoId, setMotivoId] = useState("")
  const [motivos, setMotivos] = useState<{ id: string; nome: string }[]>([])
  const [salvando, setSalvando] = useState(false)
  const [exportando, setExportando] = useState(false)

  async function exportar(tipo: "pdf" | "word") {
    if (!proposta) return
    setExportando(true)
    try {
      const d = await montarDocumento(proposta.id)
      if (!d) { toast.error("Não foi possível montar o documento."); return }
      if (tipo === "pdf") baixarBlob(gerarPdf(d.doc, d.empresa), `${d.doc.numero}.pdf`)
      else baixarBlob(await gerarWord(d.doc, d.empresa), `${d.doc.numero}.docx`)
    } catch (e) {
      toast.error("Falha ao gerar o documento.")
    } finally {
      setExportando(false)
    }
  }

  // Reseta o controle de status sempre que a proposta selecionada muda.
  useEffect(() => {
    setNovoStatus("")
    setMotivoId("")
  }, [proposta?.id])

  // Carrega os motivos de perda quando o status escolhido é "Perdida".
  useEffect(() => {
    if (novoStatus !== "Perdida" || motivos.length) return
    listarOpcoes("motivo_perda")
      .then((data) => setMotivos(data.map((o) => ({ id: o.id, nome: o.nome }))))
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar motivos de perda."),
      )
  }, [novoStatus, motivos.length])

  if (!proposta) return null

  const diff = proposta.valorFinal - proposta.valorSugerido
  const diffPct = proposta.valorSugerido ? (diff / proposta.valorSugerido) * 100 : 0

  async function alterarStatus() {
    if (!proposta || !novoStatus) return
    if (novoStatus === "Perdida" && !motivoId) {
      toast.error("Selecione o motivo da perda.")
      return
    }
    setSalvando(true)
    try {
      await transicionarStatus(proposta.id, novoStatus, novoStatus === "Perdida" ? motivoId : null)
      toast.success(`Status alterado para "${novoStatus}".`)
      onStatusChanged?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar status.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="space-y-3 border-b border-border p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{proposta.numero}</span>
            <StatusBadge status={proposta.status} />
          </div>
          <SheetTitle className="text-pretty text-lg">{proposta.empreendimento}</SheetTitle>
          <SheetDescription className="flex flex-col gap-1 text-left">
            <span className="flex items-center gap-1.5 text-foreground">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {proposta.cliente}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {proposta.cidade}/{proposta.uf} · {proposta.tipo} · {proposta.area.toLocaleString("pt-BR")} m²
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-6">
          <section className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Disciplinas
            </h4>
            <div className="space-y-2">
              {proposta.itens.map((item) => {
                const d = item.valorFinal - item.valorSugerido
                return (
                  <div
                    key={item.disciplinaId}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="text-sm text-foreground">{item.disciplina}</span>
                    <span className="text-sm font-medium tabular-nums">{formatBRL(item.valorFinal)}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo financeiro</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Valor sugerido</p>
                <p className="text-base font-semibold tabular-nums">{formatBRL(proposta.valorSugerido)}</p>
              </div>
              <div className="rounded-md bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Valor final</p>
                <p className="text-base font-semibold tabular-nums">{formatBRL(proposta.valorFinal)}</p>
              </div>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 text-sm",
                diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-[oklch(0.45_0.1_155)]" : "text-danger",
              )}
            >
              {diff > 0 ? <TrendingUp className="h-4 w-4" /> : diff < 0 ? <TrendingDown className="h-4 w-4" /> : null}
              <span>
                Diferença: {diff >= 0 ? "+" : ""}
                {formatBRL(diff)} ({diffPct >= 0 ? "+" : ""}
                {diffPct.toFixed(1)}%)
              </span>
            </div>
          </section>

          <Separator />

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximos passos</h4>
            <p className="text-sm text-foreground">{proposta.proximosPassos}</p>
            {proposta.motivoPerda && (
              <p className="text-sm text-danger">Motivo da perda: {proposta.motivoPerda}</p>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico de ações</h4>
            <ol className="relative space-y-4 border-l border-border pl-4">
              {proposta.historico.map((h, i) => (
                <li key={i} className="space-y-0.5">
                  <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-sm text-foreground">{h.acao}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(h.data)} · {h.usuario}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="sticky bottom-0 space-y-3 border-t border-border bg-card p-4">
          <div className="flex flex-col gap-2">
            <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as StatusProposta)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Alterar status..." />
              </SelectTrigger>
              <SelectContent>
                {statusOptions
                  .filter((s) => s !== proposta.status)
                  .map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {novoStatus === "Perdida" && (
              <Select value={motivoId} onValueChange={setMotivoId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Motivo da perda..." />
                </SelectTrigger>
                <SelectContent>
                  {motivos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" disabled={exportando} onClick={() => exportar("pdf")}>
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="flex-1" disabled={exportando} onClick={() => exportar("word")}>
              <Download className="h-4 w-4" /> Word
            </Button>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => router.push(`/propostas/nova?id=${proposta.id}`)}>
              Editar proposta
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={!novoStatus || salvando}
              onClick={alterarStatus}
            >
              {salvando ? "Salvando..." : "Alterar status"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
