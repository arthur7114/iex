"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  MapPin,
  Layers,
  TrendingDown,
  TrendingUp,
  Download,
  FileText,
  Mail,
  BadgePercent,
  ArrowRightLeft,
  Sparkles,
  CircleCheck,
  CircleAlert,
  Clock,
  Eye,
  History,
  AlertTriangle,
  RotateCcw,
} from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/status-badge"
import { formatBRL } from "@/lib/mock-data"
import { transicionarStatus } from "@/lib/db/propostas"
import { listarOpcoes } from "@/lib/db/lookups"
import { carregarHistorico, type ItemHistorico, type StatusEnvio } from "@/lib/db/historico"
import { getVersaoSnapshot } from "@/lib/db/versoes"
import { getConfigEmpresa } from "@/lib/db/config"
import type { Proposta, StatusProposta } from "@/lib/db/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { montarDocumento, montarEmpresa } from "@/lib/document/montar"
import { gerarPdf } from "@/lib/document/pdf"
import { gerarWord } from "@/lib/document/word"
import { baixarBlob } from "@/lib/document/util"

const statusOptions: StatusProposta[] = ["Em elaboração", "Enviada", "Aprovada", "Perdida"]

// Formata um timestamp para a linha do tempo. Aceita ISO completo (com hora) ou
// data pura (YYYY-MM-DD); nesse caso omite a hora em vez de exibir "00:00".
function formatarQuando(valor: string): string {
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return valor
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  if (!valor.includes("T")) return data
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return `${data} · ${hora}`
}

const envioMeta: Record<StatusEnvio, { rotulo: string; classe: string }> = {
  enviado: { rotulo: "Enviado", classe: "bg-positive/12 text-[oklch(0.4_0.1_155)] dark:text-[oklch(0.8_0.13_155)] border-positive/30" },
  simulado: { rotulo: "Simulado", classe: "bg-gold/15 text-[oklch(0.45_0.08_75)] dark:text-[oklch(0.82_0.11_75)] border-gold/30" },
  falha: { rotulo: "Falha no envio", classe: "bg-danger/10 text-danger border-danger/25" },
}

// Marcador (ícone + cor) por tipo/categoria de entrada — dá a distinção
// visual entre alterações comerciais, mudanças de status, versões e envios.
function marcador(item: ItemHistorico): { Icon: typeof FileText; classe: string } {
  switch (item.tipo) {
    case "ajuste":
      return { Icon: BadgePercent, classe: "bg-gold/15 text-[oklch(0.45_0.08_75)] dark:text-[oklch(0.82_0.11_75)]" }
    case "versao":
      return { Icon: FileText, classe: "bg-primary/10 text-primary" }
    case "email":
      return item.status === "falha"
        ? { Icon: CircleAlert, classe: "bg-danger/10 text-danger" }
        : item.status === "simulado"
          ? { Icon: Clock, classe: "bg-gold/15 text-[oklch(0.45_0.08_75)] dark:text-[oklch(0.82_0.11_75)]" }
          : { Icon: CircleCheck, classe: "bg-positive/12 text-[oklch(0.4_0.1_155)] dark:text-[oklch(0.8_0.13_155)]" }
    case "evento":
      return item.categoria === "status"
        ? { Icon: ArrowRightLeft, classe: "bg-primary/10 text-primary" }
        : { Icon: Sparkles, classe: "bg-muted text-muted-foreground" }
  }
}

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

  // Histórico (Onda 2 · Frente B)
  const [aba, setAba] = useState<"detalhes" | "historico">("detalhes")
  const [historico, setHistorico] = useState<ItemHistorico[] | null>(null)
  const [carregandoHist, setCarregandoHist] = useState(false)
  const [erroHist, setErroHist] = useState(false)
  const [tentativaHist, setTentativaHist] = useState(0)
  const [versaoOcupada, setVersaoOcupada] = useState<number | null>(null)

  async function exportar(tipo: "pdf" | "word") {
    if (!proposta) return
    setExportando(true)
    try {
      const d = await montarDocumento(proposta.id)
      if (!d) { toast.error("Não foi possível montar o documento."); return }
      if (tipo === "pdf") baixarBlob(gerarPdf(d.doc, d.empresa), `${d.doc.numero}.pdf`)
      else baixarBlob(await gerarWord(d.doc, d.empresa), `${d.doc.numero}.docx`)
      toast.success(`Documento ${tipo === "pdf" ? "PDF" : "Word"} gerado.`)
    } catch (e) {
      toast.error("Falha ao gerar o documento.")
    } finally {
      setExportando(false)
    }
  }

  // Visualiza (abre em nova aba) ou baixa uma versão anterior a partir do
  // snapshot salvo — reaproveita a geração de documento existente.
  async function versaoAcao(versao: number, acao: "ver" | "baixar") {
    if (!proposta) return
    setVersaoOcupada(versao)
    try {
      const [snap, config] = await Promise.all([getVersaoSnapshot(proposta.id, versao), getConfigEmpresa()])
      if (!snap) { toast.error("Snapshot da versão indisponível."); return }
      const empresa = await montarEmpresa(config)
      const blob = gerarPdf(snap, empresa)
      if (acao === "baixar") {
        baixarBlob(blob, `${snap.numero}-v${versao}.pdf`)
      } else {
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank", "noopener,noreferrer")
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      }
    } catch (e) {
      toast.error("Não foi possível gerar a versão.")
    } finally {
      setVersaoOcupada(null)
    }
  }

  // Reseta o controle de status e a aba sempre que a proposta selecionada muda.
  useEffect(() => {
    setNovoStatus("")
    setMotivoId("")
    setAba("detalhes")
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

  // Carrega a linha do tempo quando o drawer abre para uma proposta.
  useEffect(() => {
    if (!open || !proposta?.id) return
    let ativo = true
    setHistorico(null)
    setErroHist(false)
    setCarregandoHist(true)
    carregarHistorico(proposta.id)
      .then((itens) => { if (ativo) setHistorico(itens) })
      .catch(() => { if (ativo) setErroHist(true) })
      .finally(() => { if (ativo) setCarregandoHist(false) })
    return () => { ativo = false }
  }, [open, proposta?.id, tentativaHist])

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
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="space-y-3 border-b border-border p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{proposta.numero}</span>
            <StatusBadge status={proposta.status} />
          </div>
          <SheetTitle className="text-pretty text-lg">{proposta.empreendimento}</SheetTitle>
          <SheetDescription className="flex flex-col gap-1 text-left">
            <span className="flex items-center gap-1.5 text-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {proposta.cliente}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {proposta.cidade}/{proposta.uf} · {proposta.tipo} · {proposta.area.toLocaleString("pt-BR")} m²
            </span>
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={aba}
          onValueChange={(v) => setAba(v as "detalhes" | "historico")}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="border-b border-border px-6 py-3">
            <TabsList className="w-full">
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="historico">
                <History className="h-3.5 w-3.5" /> Histórico
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="detalhes" className="min-h-0 overflow-y-auto">
            <div className="space-y-6 p-6">
              <section className="space-y-3">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" /> Disciplinas
                </h4>
                <div className="space-y-2">
                  {proposta.itens.map((item) => (
                    <div
                      key={item.disciplinaId}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm text-foreground">{item.disciplina}</span>
                      <span className="shrink-0 text-sm font-medium tabular-nums">{formatBRL(item.valorFinal)}</span>
                    </div>
                  ))}
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
                    diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-[oklch(0.45_0.1_155)] dark:text-[oklch(0.8_0.13_155)]" : "text-danger",
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
            </div>
          </TabsContent>

          <TabsContent value="historico" className="min-h-0 overflow-y-auto">
            <div className="p-6">
              <HistoricoView
                estado={carregandoHist ? "carregando" : erroHist ? "erro" : "pronto"}
                itens={historico ?? []}
                versaoOcupada={versaoOcupada}
                onVersaoAcao={versaoAcao}
                onTentarNovamente={() => setTentativaHist((t) => t + 1)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-3 border-t border-border bg-card p-4">
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

// ---------------------------------------------------------------------------
// Linha do tempo do histórico — estados de carregando/erro/vazio e as entradas.
// ---------------------------------------------------------------------------
function HistoricoView({
  estado,
  itens,
  versaoOcupada,
  onVersaoAcao,
  onTentarNovamente,
}: {
  estado: "carregando" | "erro" | "pronto"
  itens: ItemHistorico[]
  versaoOcupada: number | null
  onVersaoAcao: (versao: number, acao: "ver" | "baixar") => void
  onTentarNovamente: () => void
}) {
  if (estado === "carregando") {
    return (
      <ul className="space-y-5" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  if (estado === "erro") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-10 text-center">
        <AlertTriangle className="h-5 w-5 text-danger" />
        <div>
          <p className="text-sm font-medium text-foreground">Não foi possível carregar o histórico</p>
          <p className="text-xs text-muted-foreground">Verifique a conexão e tente novamente.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onTentarNovamente}>
          <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
        </Button>
      </div>
    )
  }

  if (!itens.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
        <History className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Sem histórico ainda</p>
        <p className="text-xs text-muted-foreground">
          Versões, ajustes de preço e envios de e-mail aparecerão aqui conforme a proposta evolui.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {itens.map((item) => (
        <HistoricoEntrada
          key={item.id}
          item={item}
          versaoOcupada={versaoOcupada}
          onVersaoAcao={onVersaoAcao}
        />
      ))}
    </ul>
  )
}

function HistoricoEntrada({
  item,
  versaoOcupada,
  onVersaoAcao,
}: {
  item: ItemHistorico
  versaoOcupada: number | null
  onVersaoAcao: (versao: number, acao: "ver" | "baixar") => void
}) {
  const { Icon, classe } = marcador(item)
  return (
    <li className="flex gap-3">
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", classe)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <ConteudoEntrada item={item} versaoOcupada={versaoOcupada} onVersaoAcao={onVersaoAcao} />
        <p className="text-xs text-muted-foreground">{formatarQuando(item.data)}</p>
      </div>
    </li>
  )
}

function ConteudoEntrada({
  item,
  versaoOcupada,
  onVersaoAcao,
}: {
  item: ItemHistorico
  versaoOcupada: number | null
  onVersaoAcao: (versao: number, acao: "ver" | "baixar") => void
}) {
  switch (item.tipo) {
    case "versao": {
      const ocupada = versaoOcupada === item.versao
      return (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Versão {item.versao} gerada</p>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatBRL(item.valorTotal)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={ocupada}
              onClick={() => onVersaoAcao(item.versao, "ver")}
            >
              <Eye className="h-3.5 w-3.5" /> Visualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={ocupada}
              onClick={() => onVersaoAcao(item.versao, "baixar")}
            >
              <Download className="h-3.5 w-3.5" /> {ocupada ? "Gerando..." : "Baixar PDF"}
            </Button>
          </div>
        </div>
      )
    }
    case "ajuste": {
      const subiu = item.valorFinal >= item.valorSugerido
      return (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Ajuste de preço · <span className="font-normal">{item.disciplina}</span>
          </p>
          <p
            className={cn(
              "flex flex-wrap items-center gap-x-1.5 text-sm tabular-nums",
              subiu ? "text-[oklch(0.45_0.1_155)] dark:text-[oklch(0.8_0.13_155)]" : "text-danger",
            )}
          >
            <span className="text-muted-foreground line-through">{formatBRL(item.valorSugerido)}</span>
            <ArrowRightLeft className="h-3 w-3 shrink-0" />
            <span className="font-medium">{formatBRL(item.valorFinal)}</span>
            <span className="text-xs">
              ({item.variacaoPct >= 0 ? "+" : ""}
              {item.variacaoPct.toFixed(1)}%)
            </span>
          </p>
          {item.justificativa && (
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground">Justificativa:</span> {item.justificativa}
            </p>
          )}
        </div>
      )
    }
    case "email": {
      const meta = envioMeta[item.status]
      return (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">E-mail enviado</p>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                meta.classe,
              )}
            >
              {meta.rotulo}
            </span>
          </div>
          <p className="break-words text-sm text-muted-foreground">
            <span className="text-foreground">Para:</span> {item.destinatario}
          </p>
          <p className="break-words text-sm text-muted-foreground">{item.assunto}</p>
        </div>
      )
    }
    case "evento":
      return (
        <p className="text-sm text-foreground">
          {item.acao}
          {item.usuario !== "—" && (
            <span className="text-muted-foreground"> · {item.usuario}</span>
          )}
        </p>
      )
  }
}
