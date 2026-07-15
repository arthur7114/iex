"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  RefreshCw,
  Copy,
  Download,
  Send,
  Clock,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react"
import { Shell, PageHeader } from "@/components/shell"
import { StatusBadge } from "@/components/status-badge"
import { ProposalDrawer } from "@/components/proposal-drawer"
import { EmailComposer, type ResultadoEnvio } from "@/components/email-composer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatBRL, formatDate } from "@/lib/mock-data"
import { listarPropostas, duplicarProposta, transicionarStatus } from "@/lib/db/propostas"
import { getUsuarioAtual } from "@/lib/db/usuarios"
import { montarDocumento } from "@/lib/document/montar"
import { gerarPdf } from "@/lib/document/pdf"
import { gerarWord } from "@/lib/document/word"
import { baixarBlob, blobParaBase64 } from "@/lib/document/util"
import { enviarProposta } from "@/lib/actions/email"
import type { Proposta, StatusProposta } from "@/lib/db/types"
import type { EmpresaDoc, PropostaDoc } from "@/lib/document/tipos"

const statusOptions: StatusProposta[] = ["Em elaboração", "Enviada", "Aprovada", "Perdida"]
const STATUS_VALIDOS = new Set<string>(statusOptions)
const DIAS_ALERTA = 7
const POR_PAGINA = 12

type CampoOrdenacao =
  | "numero"
  | "cliente"
  | "tipo"
  | "valorSugerido"
  | "valorFinal"
  | "dataEnvio"
  | "ultimaAtualizacao"
type Ordenacao = { campo: CampoOrdenacao; dir: "asc" | "desc" } | null

export default function PropostasPage() {
  return (
    <Suspense fallback={<PropostasFallback />}>
      <PropostasContent />
    </Suspense>
  )
}

function PropostasFallback() {
  return (
    <Shell breadcrumb={["IEX", "Propostas"]}>
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
        Carregando...
      </div>
    </Shell>
  )
}

function PropostasContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusParam = searchParams.get("status")
  const openParam = searchParams.get("open")

  const [busca, setBusca] = useState("")
  const [status, setStatus] = useState<string>(
    statusParam && STATUS_VALIDOS.has(statusParam) ? statusParam : "todos",
  )
  const [tipo, setTipo] = useState("todos")
  const [responsavel, setResponsavel] = useState("todos")
  const [ordenacao, setOrdenacao] = useState<Ordenacao>(null)
  const [pagina, setPagina] = useState(1)

  const [selected, setSelected] = useState<Proposta | null>(null)
  const [open, setOpen] = useState(false)
  const [enviarProp, setEnviarProp] = useState<Proposta | null>(null)
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const openAplicado = useRef<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const data = await listarPropostas()
      setPropostas(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar propostas.")
    }
  }, [])

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(false)
    listarPropostas()
      .then((data) => {
        if (ativo) setPropostas(data)
      })
      .catch((error) => {
        if (!ativo) return
        setErro(true)
        toast.error(error instanceof Error ? error.message : "Erro ao carregar propostas.")
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [tentativa])

  // Sincroniza o filtro de status quando o dashboard navega para ?status=<StatusProposta>.
  useEffect(() => {
    if (statusParam && STATUS_VALIDOS.has(statusParam)) setStatus(statusParam)
  }, [statusParam])

  // Abre o drawer automaticamente ao chegar via ?open=<id> (busca global / notificações).
  useEffect(() => {
    if (!openParam || openAplicado.current === openParam) return
    const alvo = propostas.find((p) => p.id === openParam)
    if (alvo) {
      openAplicado.current = openParam
      setSelected(alvo)
      setOpen(true)
    }
  }, [openParam, propostas])

  const tipos = useMemo(
    () => Array.from(new Set(propostas.map((p) => p.tipo).filter(Boolean))).sort(),
    [propostas],
  )
  const responsaveisLista = useMemo(
    () => Array.from(new Set(propostas.map((p) => p.responsavel).filter(Boolean))).sort(),
    [propostas],
  )

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const base = propostas.filter((p) => {
      const matchBusca =
        !termo ||
        p.cliente.toLowerCase().includes(termo) ||
        p.numero.toLowerCase().includes(termo) ||
        p.empreendimento.toLowerCase().includes(termo)
      const matchStatus = status === "todos" || p.status === status
      const matchTipo = tipo === "todos" || p.tipo === tipo
      const matchResp = responsavel === "todos" || p.responsavel === responsavel
      return matchBusca && matchStatus && matchTipo && matchResp
    })
    if (!ordenacao) return base
    const { campo, dir } = ordenacao
    const fator = dir === "asc" ? 1 : -1
    return [...base].sort((a, b) => {
      const va = a[campo]
      const vb = b[campo]
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * fator
      return String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", { numeric: true }) * fator
    })
  }, [propostas, busca, status, tipo, responsavel, ordenacao])

  // Reseta a página ao mudar filtros/ordenação.
  useEffect(() => {
    setPagina(1)
  }, [busca, status, tipo, responsavel, ordenacao])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * POR_PAGINA
  const visiveis = filtradas.slice(inicio, inicio + POR_PAGINA)

  function abrir(p: Proposta) {
    setSelected(p)
    setOpen(true)
  }

  function alternarOrdenacao(campo: CampoOrdenacao) {
    setOrdenacao((prev) => {
      if (!prev || prev.campo !== campo) return { campo, dir: "asc" }
      if (prev.dir === "asc") return { campo, dir: "desc" }
      return null
    })
  }

  async function duplicar(p: Proposta) {
    try {
      const result = await duplicarProposta(p.id)
      toast.success(`Proposta ${result.numero} duplicada`)
      await recarregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao duplicar proposta.")
    }
  }

  async function exportar(p: Proposta, formato: "pdf" | "word") {
    const carregandoToast = toast.loading("Gerando documento...")
    try {
      const bundle = await montarDocumento(p.id)
      if (!bundle) {
        toast.error("Não foi possível montar o documento.", { id: carregandoToast })
        return
      }
      if (formato === "pdf") baixarBlob(gerarPdf(bundle.doc, bundle.empresa), `${bundle.doc.numero}.pdf`)
      else baixarBlob(await gerarWord(bundle.doc, bundle.empresa), `${bundle.doc.numero}.docx`)
      toast.success(`Documento ${formato === "pdf" ? "PDF" : "Word"} gerado.`, { id: carregandoToast })
    } catch {
      toast.error("Falha ao gerar o documento.", { id: carregandoToast })
    }
  }

  return (
    <Shell breadcrumb={["IEX", "Propostas"]}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <PageHeader
          title="Propostas"
          description="Gestão comercial de todas as propostas de engenharia."
          actions={
            <Button asChild>
              <Link href="/propostas/nova">
                <Plus className="h-4 w-4" /> Nova proposta
              </Link>
            </Button>
          }
        />

        <Card className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por cliente, número ou empreendimento..."
                className="bg-background pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-background lg:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="bg-background lg:w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={responsavel} onValueChange={setResponsavel}>
                <SelectTrigger className="bg-background lg:w-44"><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos responsáveis</SelectItem>
                  {responsaveisLista.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead campo="numero" ordenacao={ordenacao} onSort={alternarOrdenacao}>Proposta</SortableHead>
                  <SortableHead campo="cliente" ordenacao={ordenacao} onSort={alternarOrdenacao}>Cliente</SortableHead>
                  <SortableHead campo="tipo" ordenacao={ordenacao} onSort={alternarOrdenacao}>Tipo</SortableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead campo="valorSugerido" ordenacao={ordenacao} onSort={alternarOrdenacao} align="right">Valor sugerido</SortableHead>
                  <SortableHead campo="valorFinal" ordenacao={ordenacao} onSort={alternarOrdenacao} align="right">Valor final</SortableHead>
                  <SortableHead campo="dataEnvio" ordenacao={ordenacao} onSort={alternarOrdenacao}>Enviada</SortableHead>
                  <SortableHead campo="ultimaAtualizacao" ordenacao={ordenacao} onSort={alternarOrdenacao}>Atualização</SortableHead>
                  <TableHead className="w-10 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando && propostas.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="mt-1.5 h-3 w-32" />
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
                    </TableRow>
                  ))
                ) : erro ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="py-12">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <AlertTriangle className="h-6 w-6 text-danger" />
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            Não foi possível carregar as propostas
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Verifique sua conexão e tente novamente.
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setTentativa((t) => t + 1)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                {!carregando && !erro && visiveis.map((p) => {
                  const semRetorno = p.status === "Enviada" && p.diasSemRetorno >= DIAS_ALERTA
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => abrir(p)}
                    >
                      <TableCell>
                        <div className="font-medium">{p.numero}</div>
                        <div className="max-w-[180px] truncate text-xs text-muted-foreground">{p.empreendimento}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.cliente}</TableCell>
                      <TableCell className="text-muted-foreground">{p.tipo}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={p.status} />
                          {semRetorno && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[oklch(0.5_0.12_65)] dark:text-[oklch(0.78_0.13_75)]">
                              <Clock className="h-3 w-3" />
                              {p.diasSemRetorno} dias sem retorno
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatBRL(p.valorSugerido)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatBRL(p.valorFinal)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.dataEnvio)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.ultimaAtualizacao)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Ações rápidas evidenciadas por linha (lg+). Em telas menores, tudo no menu. */}
                          <div className="hidden items-center gap-0.5 lg:flex">
                            <IconAcao rotulo="Editar" onClick={() => router.push(`/propostas/nova?id=${p.id}`)}>
                              <Pencil className="h-4 w-4" />
                            </IconAcao>
                            <IconAcao rotulo="Duplicar" onClick={() => duplicar(p)}>
                              <Copy className="h-4 w-4" />
                            </IconAcao>
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <Download className="h-4 w-4" />
                                      <span className="sr-only">Exportar</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Exportar</TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => exportar(p, "pdf")}>
                                  <Download className="h-4 w-4" /> Exportar PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportar(p, "word")}>
                                  <Download className="h-4 w-4" /> Exportar Word
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <IconAcao rotulo="Enviar por e-mail" onClick={() => setEnviarProp(p)}>
                              <Send className="h-4 w-4" />
                            </IconAcao>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Mais ações</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => abrir(p)}>
                                <Eye className="h-4 w-4" /> Ver proposta
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/propostas/nova?id=${p.id}`)}>
                                <Pencil className="h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => abrir(p)}>
                                <RefreshCw className="h-4 w-4" /> Alterar status
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicar(p)}>
                                <Copy className="h-4 w-4" /> Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => exportar(p, "pdf")}>
                                <Download className="h-4 w-4" /> Exportar PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportar(p, "word")}>
                                <Download className="h-4 w-4" /> Exportar Word
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEnviarProp(p)}>
                                <Send className="h-4 w-4" /> Enviar por e-mail
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {!carregando && !erro && visiveis.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              {propostas.length === 0
                ? "Nenhuma proposta cadastrada ainda."
                : "Nenhuma proposta encontrada para os filtros selecionados."}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {filtradas.length === 0
              ? "Nenhuma proposta"
              : `Exibindo ${inicio + 1}–${Math.min(inicio + POR_PAGINA, filtradas.length)} de ${filtradas.length} ${filtradas.length === 1 ? "proposta" : "propostas"}`}
          </p>
          {totalPaginas > 1 && (
            <Paginador pagina={paginaAtual} total={totalPaginas} onChange={setPagina} />
          )}
        </div>
      </div>

      <ProposalDrawer
        proposta={selected}
        open={open}
        onOpenChange={setOpen}
        onStatusChanged={recarregar}
      />

      <EnviarDialog
        proposta={enviarProp}
        onClose={() => setEnviarProp(null)}
        onEnviado={recarregar}
      />
    </Shell>
  )
}

// Cabeçalho de coluna ordenável.
function SortableHead({
  campo,
  ordenacao,
  onSort,
  align,
  children,
}: {
  campo: CampoOrdenacao
  ordenacao: Ordenacao
  onSort: (c: CampoOrdenacao) => void
  align?: "right"
  children: React.ReactNode
}) {
  const ativo = ordenacao?.campo === campo
  const Icon = !ativo ? ChevronsUpDown : ordenacao?.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(campo)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm text-left transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          ativo ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label={`Ordenar por ${typeof children === "string" ? children : campo}`}
      >
        {children}
        <Icon className={cn("h-3.5 w-3.5", !ativo && "opacity-50")} />
      </button>
    </TableHead>
  )
}

// Botão de ação com tooltip.
function IconAcao({
  rotulo,
  onClick,
  children,
}: {
  rotulo: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClick}>
          {children}
          <span className="sr-only">{rotulo}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{rotulo}</TooltipContent>
    </Tooltip>
  )
}

// Paginador compacto reutilizando os primitivos de ui/pagination.
function Paginador({
  pagina,
  total,
  onChange,
}: {
  pagina: number
  total: number
  onChange: (p: number) => void
}) {
  const paginas: number[] = []
  const inicio = Math.max(1, Math.min(pagina - 1, total - 2))
  const fim = Math.min(total, inicio + 2)
  for (let i = inicio; i <= fim; i++) paginas.push(i)

  return (
    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            href="#"
            size="default"
            aria-label="Página anterior"
            aria-disabled={pagina <= 1}
            className={cn("cursor-pointer gap-1 px-2.5", pagina <= 1 && "pointer-events-none opacity-50")}
            onClick={(e) => {
              e.preventDefault()
              if (pagina > 1) onChange(pagina - 1)
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:block">Anterior</span>
          </PaginationLink>
        </PaginationItem>
        {paginas.map((n) => (
          <PaginationItem key={n} className="hidden sm:block">
            <PaginationLink
              href="#"
              isActive={n === pagina}
              aria-label={`Página ${n}`}
              className="cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                onChange(n)
              }}
            >
              {n}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem className="sm:hidden">
          <span className="px-2 text-sm text-muted-foreground">
            {pagina} / {total}
          </span>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink
            href="#"
            size="default"
            aria-label="Próxima página"
            aria-disabled={pagina >= total}
            className={cn("cursor-pointer gap-1 px-2.5", pagina >= total && "pointer-events-none opacity-50")}
            onClick={(e) => {
              e.preventDefault()
              if (pagina < total) onChange(pagina + 1)
            }}
          >
            <span className="hidden sm:block">Próxima</span>
            <ChevronRight className="h-4 w-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

// Diálogo de envio por e-mail — reaproveita o EmailComposer (mesmo fluxo do wizard).
function EnviarDialog({
  proposta,
  onClose,
  onEnviado,
}: {
  proposta: Proposta | null
  onClose: () => void
  onEnviado: () => void
}) {
  const [bundle, setBundle] = useState<{ doc: PropostaDoc; empresa: EmpresaDoc } | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!proposta) {
      setBundle(null)
      setErro(false)
      return
    }
    let ativo = true
    setCarregando(true)
    setErro(false)
    montarDocumento(proposta.id)
      .then((b) => {
        if (!ativo) return
        if (b) setBundle(b)
        else setErro(true)
      })
      .catch(() => ativo && setErro(true))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [proposta])

  async function handleEnviar(dados: {
    destinatario: string
    copias: string
    assunto: string
    corpo: string
    anexo: "pdf" | "word"
  }): Promise<ResultadoEnvio> {
    if (!proposta || !bundle) {
      return { ok: false, simulado: false, error: "Documento indisponível." }
    }
    try {
      const usuario = await getUsuarioAtual()
      const blob = dados.anexo === "word" ? await gerarWord(bundle.doc, bundle.empresa) : gerarPdf(bundle.doc, bundle.empresa)
      const base64 = await blobParaBase64(blob)
      const res = await enviarProposta({
        propostaId: proposta.id,
        destinatario: dados.destinatario,
        copias: dados.copias ? dados.copias.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
        assunto: dados.assunto,
        corpo: dados.corpo,
        anexoTipo: dados.anexo,
        anexoNome: `${bundle.doc.numero}.${dados.anexo === "word" ? "docx" : "pdf"}`,
        anexoBase64: base64,
        usuarioId: usuario?.id ?? null,
        usuarioNome: usuario?.nome ?? null,
      })
      if (res.ok && !res.simulado) {
        await transicionarStatus(proposta.id, "Enviada").catch(() => {})
        onEnviado()
      }
      return res
    } catch (e) {
      return { ok: false, simulado: false, error: e instanceof Error ? e.message : "Falha ao enviar o e-mail." }
    }
  }

  return (
    <Dialog open={proposta !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar proposta</DialogTitle>
          <DialogDescription>
            {proposta ? `${proposta.numero} — ${proposta.empreendimento || proposta.cliente}` : ""}
          </DialogDescription>
        </DialogHeader>
        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            Preparando documento...
          </div>
        ) : erro || !bundle ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Não foi possível preparar o documento desta proposta.
          </div>
        ) : (
          <EmailComposer
            destinatarioInicial=""
            numero={bundle.doc.numero}
            empreendimento={proposta?.empreendimento || ""}
            onEnviar={handleEnviar}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
