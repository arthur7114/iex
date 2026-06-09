"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { Search, Plus, MoreHorizontal, Eye, Pencil, RefreshCw, Copy } from "lucide-react"
import { Shell, PageHeader } from "@/components/shell"
import { StatusBadge } from "@/components/status-badge"
import { ProposalDrawer } from "@/components/proposal-drawer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import {
  propostas as allPropostas,
  tiposEmpreendimento,
  responsaveis,
  type Proposta,
  type StatusProposta,
  formatBRL,
  formatDate,
} from "@/lib/mock-data"
import { getProposals } from "@/lib/storage"

const statusOptions: StatusProposta[] = ["Em elaboração", "Enviada", "Aprovada", "Perdida"]

export default function PropostasPage() {
  const [busca, setBusca] = useState("")
  const [status, setStatus] = useState("todos")
  const [tipo, setTipo] = useState("todos")
  const [responsavel, setResponsavel] = useState("todos")
  const [selected, setSelected] = useState<Proposta | null>(null)
  const [open, setOpen] = useState(false)
  const [localPropostas, setLocalPropostas] = useState<Proposta[]>([])

  useEffect(() => {
    setLocalPropostas(getProposals())
  }, [])

  const filtradas = useMemo(() => {
    // Only display localPropostas since they are now coming from the DB
    // Or if you still want to mock some, you can combined. For now we will only show localPropostas + allPropostas
    const combined = [...localPropostas, ...allPropostas]
    return combined.filter((p) => {
      const matchBusca =
        !busca ||
        p.cliente.toLowerCase().includes(busca.toLowerCase()) ||
        p.numero.toLowerCase().includes(busca.toLowerCase())
      const matchStatus = status === "todos" || p.status === status
      const matchTipo = tipo === "todos" || p.tipo === tipo
      const matchResp = responsavel === "todos" || p.responsavel === responsavel
      return matchBusca && matchStatus && matchTipo && matchResp
    })
  }, [busca, status, tipo, responsavel])

  function abrir(p: Proposta) {
    setSelected(p)
    setOpen(true)
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
                placeholder="Buscar por cliente ou número da proposta..."
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
                  {tiposEmpreendimento.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={responsavel} onValueChange={setResponsavel}>
                <SelectTrigger className="bg-background lg:w-44"><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos responsáveis</SelectItem>
                  {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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
                  <TableHead>Proposta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor sugerido</TableHead>
                  <TableHead className="text-right">Valor final</TableHead>
                  <TableHead>Enviada</TableHead>
                  <TableHead>Atualização</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((p) => (
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
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatBRL(p.valorSugerido)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatBRL(p.valorFinal)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.dataEnvio)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.ultimaAtualizacao)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Ações</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => abrir(p)}>
                            <Eye className="h-4 w-4" /> Ver proposta
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("Abrindo editor da proposta...")}>
                            <Pencil className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success("Status atualizado.")}>
                            <RefreshCw className="h-4 w-4" /> Alterar status
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success("Proposta duplicada.")}>
                            <Copy className="h-4 w-4" /> Duplicar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtradas.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Nenhuma proposta encontrada para os filtros selecionados.
            </div>
          )}
        </Card>

        <p className="text-xs text-muted-foreground">
          Exibindo {filtradas.length} de {localPropostas.length + allPropostas.length} propostas.
        </p>
      </div>

      <ProposalDrawer proposta={selected} open={open} onOpenChange={setOpen} />
    </Shell>
  )
}
