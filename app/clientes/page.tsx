"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  Building2,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  FileText,
  Pencil,
  Archive,
  Layers,
  AlertTriangle,
  RotateCcw,
} from "lucide-react"
import { Shell } from "@/components/shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
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
import { formatBRL } from "@/lib/mock-data"
import {
  listarClientesComMetricas,
  criarCliente,
  atualizarCliente,
  getCliente,
  arquivarCliente,
  type ClienteInput,
} from "@/lib/db/clientes"
import { listarOpcoes } from "@/lib/db/lookups"
import { listarPropostas } from "@/lib/db/propostas"
import { listarObrasPorCliente, criarObra, atualizarObra, type ObraInput } from "@/lib/db/obras"
import type { Cliente, Proposta, OpcaoRef, Obra } from "@/lib/db/types"
import { toast } from "sonner"

export default function ClientesPage() {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [perfil, setPerfil] = useState("Todos")
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Cliente | null>(null)
  const [novoOpen, setNovoOpen] = useState(false)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [origens, setOrigens] = useState<OpcaoRef[]>([])
  const [perfis, setPerfis] = useState<OpcaoRef[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  // Estado do formulário "Novo cliente" / "Editar cliente".
  const formVazio = {
    razaoSocial: "",
    nomeFantasia: "",
    documento: "",
    contato: "",
    email: "",
    telefone: "",
    cidade: "",
    uf: "",
    origem: "",
    perfil: "",
    endereco: "",
    observacoes: "",
  }
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)
  // Id do cliente em edição; null = modo "novo cliente".
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [arquivando, setArquivando] = useState(false)

  // Obras do cliente selecionado + formulário de obra.
  const [tiposEmp, setTiposEmp] = useState<string[]>([])
  const [obrasSel, setObrasSel] = useState<Obra[]>([])
  const [carregandoObras, setCarregandoObras] = useState(false)
  const obraFormVazio = {
    nome: "",
    tipo: "",
    cidade: "",
    uf: "",
    endereco: "",
    area: 0,
    pavimentos: 0,
    padrao: "Médio",
    fase: "Executivo",
    urgencia: "Normal",
    repetitividade: "Não se aplica",
    observacoes: "",
  }
  const [obraForm, setObraForm] = useState(obraFormVazio)
  const [obraFormOpen, setObraFormOpen] = useState(false)
  const [editandoObraId, setEditandoObraId] = useState<string | null>(null)
  const [salvandoObra, setSalvandoObra] = useState(false)

  // Confirmação de arquivamento do cliente selecionado.
  const [confirmarArquivar, setConfirmarArquivar] = useState(false)

  async function recarregar() {
    try {
      const cs = await listarClientesComMetricas()
      setClientes(cs)
    } catch {
      toast.error("Não foi possível recarregar os clientes.")
    }
  }

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro(false)
      try {
        const [cs, ps, os, prfs, tps] = await Promise.all([
          listarClientesComMetricas(),
          listarPropostas(),
          listarOpcoes("origem_cliente"),
          listarOpcoes("perfil_cliente"),
          listarOpcoes("tipo_empreendimento"),
        ])
        if (!ativo) return
        setClientes(cs)
        setPropostas(ps)
        setOrigens(os)
        setPerfis(prfs)
        setTiposEmp(tps.map((t) => t.nome))
      } catch {
        if (ativo) setErro(true)
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [tentativa])

  const perfilNomes = useMemo(() => perfis.map((p) => p.nome), [perfis])
  const origemNomes = useMemo(() => origens.map((o) => o.nome), [origens])

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      const mq =
        c.razaoSocial.toLowerCase().includes(q.toLowerCase()) ||
        c.contato.toLowerCase().includes(q.toLowerCase())
      const mp = perfil === "Todos" || c.perfil === perfil
      return mq && mp
    })
  }, [clientes, q, perfil])

  function taxa(c: Cliente) {
    if (!c.propostasEnviadas) return 0
    return Math.round((c.propostasAprovadas / c.propostasEnviadas) * 100)
  }

  const propostasDoCliente = (clienteId: string) =>
    propostas.filter((p) => p.clienteId === clienteId)
  const propostasDaObra = (obraId: string) => propostas.filter((p) => p.obraId === obraId)
  const propostasSemObra = (clienteId: string) =>
    propostas.filter((p) => p.clienteId === clienteId && !p.obraId)

  // Carrega as obras quando um cliente é aberto no drawer de detalhe.
  useEffect(() => {
    if (!open || !sel) return
    let ativo = true
    setObrasSel([]) // limpa as obras do cliente anterior antes de buscar
    setCarregandoObras(true)
    listarObrasPorCliente(sel.id)
      .then((obras) => ativo && setObrasSel(obras))
      .catch(() => ativo && setObrasSel([]))
      .finally(() => ativo && setCarregandoObras(false))
    return () => {
      ativo = false
    }
  }, [open, sel?.id])

  async function recarregarObras() {
    if (!sel) return
    try {
      setObrasSel(await listarObrasPorCliente(sel.id))
    } catch {
      /* mantém lista atual */
    }
  }

  function abrirNovaObra() {
    setEditandoObraId(null)
    setObraForm({ ...obraFormVazio, tipo: tiposEmp[0] ?? "" })
    setObraFormOpen(true)
  }

  function abrirEdicaoObra(o: Obra) {
    setEditandoObraId(o.id)
    setObraForm({
      nome: o.nome,
      tipo: o.tipo,
      cidade: o.cidade,
      uf: o.uf,
      endereco: o.endereco,
      area: o.area,
      pavimentos: o.pavimentos ?? 0,
      padrao: o.padrao || "Médio",
      fase: o.fase || "Executivo",
      urgencia: o.urgencia || "Normal",
      repetitividade: o.repetitividade || "Não se aplica",
      observacoes: o.observacoes,
    })
    setObraFormOpen(true)
  }

  async function salvarObra() {
    if (!sel) return
    if (!obraForm.nome.trim()) {
      toast.error("Informe o nome da obra.")
      return
    }
    setSalvandoObra(true)
    try {
      const input: ObraInput = { clienteId: sel.id, ...obraForm, nome: obraForm.nome.trim() }
      if (editandoObraId) {
        await atualizarObra(editandoObraId, input)
        toast.success("Obra atualizada.")
      } else {
        await criarObra(input)
        toast.success("Obra cadastrada.")
      }
      setObraFormOpen(false)
      setEditandoObraId(null)
      await recarregarObras()
    } catch {
      toast.error("Não foi possível salvar a obra.")
    } finally {
      setSalvandoObra(false)
    }
  }

  function novaProposta(clienteId: string, obraId?: string) {
    const qs = obraId ? `?cliente=${clienteId}&obra=${obraId}` : `?cliente=${clienteId}`
    router.push(`/propostas/nova${qs}`)
  }

  function resetForm() {
    setForm({
      ...formVazio,
      origem: origemNomes[0] ?? "",
      perfil: perfilNomes[2] ?? perfilNomes[0] ?? "",
    })
  }

  function abrirNovo() {
    setEditandoId(null)
    resetForm()
    setNovoOpen(true)
  }

  // Prefill do formulário com os dados do cliente selecionado e abre em modo edição.
  async function abrirEdicao(id: string) {
    try {
      const c = await getCliente(id)
      if (!c) {
        toast.error("Cliente não encontrado.")
        return
      }
      setEditandoId(id)
      setForm({
        razaoSocial: c.razaoSocial ?? "",
        nomeFantasia: c.nomeFantasia ?? "",
        documento: c.documento ?? "",
        contato: c.contato ?? "",
        email: c.email ?? "",
        telefone: c.telefone ?? "",
        cidade: c.cidade ?? "",
        uf: c.uf ?? "",
        origem: c.origem ?? "",
        perfil: c.perfil ?? "",
        endereco: c.endereco ?? "",
        observacoes: c.observacoes ?? "",
      })
      setOpen(false)
      setNovoOpen(true)
    } catch {
      toast.error("Não foi possível carregar o cliente para edição.")
    }
  }

  function montarInput(): ClienteInput {
    return {
      razaoSocial: form.razaoSocial.trim(),
      nomeFantasia: form.nomeFantasia.trim() || undefined,
      documento: form.documento.trim() || undefined,
      contato: form.contato.trim() || undefined,
      email: form.email.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      origem: form.origem || undefined,
      perfil: form.perfil || undefined,
      cidade: form.cidade.trim() || undefined,
      uf: form.uf.trim() || undefined,
      endereco: form.endereco.trim() || undefined,
      observacoes: form.observacoes.trim() || undefined,
    }
  }

  async function salvarCliente() {
    if (!form.razaoSocial.trim()) {
      toast.error("Informe a razão social.")
      return
    }
    setSalvando(true)
    try {
      const input = montarInput()
      if (editandoId) {
        await atualizarCliente(editandoId, input)
        toast.success("Cliente atualizado com sucesso.")
      } else {
        await criarCliente(input)
        toast.success("Cliente cadastrado com sucesso.")
      }
      setNovoOpen(false)
      setEditandoId(null)
      await recarregar()
    } catch {
      toast.error(
        editandoId
          ? "Não foi possível atualizar o cliente."
          : "Não foi possível cadastrar o cliente.",
      )
    } finally {
      setSalvando(false)
    }
  }

  async function arquivarSelecionado() {
    if (!sel) return
    setArquivando(true)
    try {
      await arquivarCliente(sel.id)
      toast.success("Cliente arquivado com sucesso.")
      setConfirmarArquivar(false)
      setOpen(false)
      await recarregar()
    } catch {
      toast.error("Não foi possível arquivar o cliente. Tente novamente.")
    } finally {
      setArquivando(false)
    }
  }

  return (
    <Shell breadcrumb={["IEX", "Clientes"]}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground">
              Base de relacionamento e histórico comercial.
            </p>
          </div>
          <Button onClick={abrirNovo}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por razão social ou contato..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={perfil} onValueChange={setPerfil}>
              <SelectTrigger className="sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os perfis</SelectItem>
                {perfilNomes.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Razão social</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="text-center">Propostas</TableHead>
                  <TableHead className="text-center">Conversão</TableHead>
                  <TableHead className="text-right">Valor aprovado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-10" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-10" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : erro ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <AlertTriangle className="h-6 w-6 text-danger" />
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            Não foi possível carregar os clientes
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
                ) : filtered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-12">
                      {clientes.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 text-center">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">
                              Nenhum cliente cadastrado
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Cadastre o primeiro cliente para começar a montar propostas.
                            </p>
                          </div>
                          <Button size="sm" onClick={abrirNovo}>
                            <Plus className="h-4 w-4" /> Novo cliente
                          </Button>
                        </div>
                      ) : (
                        <p className="text-center text-sm text-muted-foreground">
                          Nenhum cliente corresponde aos filtros aplicados.
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSel(c)
                        setOpen(true)
                      }}
                    >
                      <TableCell className="font-medium text-foreground">{c.razaoSocial}</TableCell>
                      <TableCell className="text-muted-foreground">{c.contato}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.cidade}/{c.uf}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {c.perfil}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground">
                        {c.propostasAprovadas}/{c.propostasEnviadas}
                      </TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{taxa(c)}%</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatBRL(c.valorAprovado)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Drawer de detalhe */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {sel && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <SheetTitle className="text-balance">{sel.razaoSocial}</SheetTitle>
                    <SheetDescription>
                      {sel.perfil} · origem: {sel.origem}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Enviadas" value={String(sel.propostasEnviadas)} />
                  <MiniStat label="Aprovadas" value={String(sel.propostasAprovadas)} />
                  <MiniStat label="Conversão" value={`${taxa(sel)}%`} />
                </div>
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail" value={sel.email} />
                  <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={sel.telefone} />
                  <InfoRow
                    icon={<MapPin className="h-4 w-4" />}
                    label="Localização"
                    value={`${sel.cidade}/${sel.uf}`}
                  />
                  <InfoRow
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Valor aprovado"
                    value={formatBRL(sel.valorAprovado)}
                  />
                </div>
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Layers className="h-4 w-4 text-muted-foreground" /> Obras
                    </h3>
                    <Button variant="outline" size="sm" onClick={abrirNovaObra}>
                      <Plus className="h-4 w-4" /> Nova obra
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {carregandoObras && (
                      <>
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                      </>
                    )}
                    {obrasSel.map((o) => (
                      <div key={o.id} className="rounded-lg border border-border">
                        <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{o.nome}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[o.tipo, o.cidade && `${o.cidade}/${o.uf}`, o.area ? `${o.area.toLocaleString("pt-BR")} m²` : ""]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="sm" onClick={() => abrirEdicaoObra(o)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => novaProposta(sel.id, o.id)}>
                              <FileText className="h-3.5 w-3.5" /> Proposta
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1.5 p-3">
                          {propostasDaObra(o.id).map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{p.numero}</span>
                              <span className="font-medium tabular-nums text-foreground">{formatBRL(p.valorFinal)}</span>
                            </div>
                          ))}
                          {propostasDaObra(o.id).length === 0 && (
                            <p className="text-xs text-muted-foreground">Sem propostas nesta obra.</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {!carregandoObras && obrasSel.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma obra cadastrada para este cliente.
                      </p>
                    )}
                    {propostasSemObra(sel.id).length > 0 && (
                      <div className="rounded-lg border border-dashed border-border p-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Propostas sem obra vinculada</p>
                        <div className="space-y-1.5">
                          {propostasSemObra(sel.id).map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{p.numero} · {p.empreendimento}</span>
                              <span className="font-medium tabular-nums text-foreground">{formatBRL(p.valorFinal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <SheetFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => abrirEdicao(sel.id)}
                >
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmarArquivar(true)}
                  disabled={arquivando}
                >
                  <Archive className="h-4 w-4" />
                  Arquivar
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
                <Button onClick={() => novaProposta(sel.id)}>
                  <FileText className="h-4 w-4" /> Nova proposta
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Drawer novo cliente / edição */}
      <Sheet
        open={novoOpen}
        onOpenChange={(o) => {
          setNovoOpen(o)
          if (!o) setEditandoId(null)
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editandoId ? "Editar cliente" : "Novo cliente"}</SheetTitle>
            <SheetDescription>
              {editandoId
                ? "Atualize os dados do cliente."
                : "Cadastre um cliente na base de relacionamento."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            <div className="space-y-1.5">
              <Label>Razão social</Label>
              <Input
                placeholder="Ex.: Construtora Horizonte"
                value={form.razaoSocial}
                onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome fantasia</Label>
                <Input
                  placeholder="Nome fantasia"
                  value={form.nomeFantasia}
                  onChange={(e) => setForm((f) => ({ ...f, nomeFantasia: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Documento (CNPJ/CPF)</Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={form.documento}
                  onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Contato principal</Label>
              <Input
                placeholder="Nome do responsável"
                value={form.contato}
                onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="contato@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 0000-0000"
                  value={form.telefone}
                  onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input
                  placeholder="Cidade"
                  value={form.cidade}
                  onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Input
                  placeholder="UF"
                  maxLength={2}
                  value={form.uf}
                  onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Select
                  value={form.origem}
                  onValueChange={(v) => setForm((f) => ({ ...f, origem: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {origemNomes.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Perfil</Label>
                <Select
                  value={form.perfil}
                  onValueChange={(v) => setForm((f) => ({ ...f, perfil: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {perfilNomes.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input
                placeholder="Rua, número, bairro"
                value={form.endereco}
                onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                placeholder="Anotações sobre o cliente"
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNovoOpen(false)
                setEditandoId(null)
              }}
            >
              Cancelar
            </Button>
            <Button onClick={salvarCliente} disabled={salvando}>
              {salvando
                ? "Salvando..."
                : editandoId
                  ? "Salvar alterações"
                  : "Salvar cliente"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Drawer nova obra / edição de obra */}
      <Sheet
        open={obraFormOpen}
        onOpenChange={(o) => {
          setObraFormOpen(o)
          if (!o) setEditandoObraId(null)
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editandoObraId ? "Editar obra" : "Nova obra"}</SheetTitle>
            <SheetDescription>
              {sel ? `Obra de ${sel.razaoSocial}.` : "Cadastro de obra."} O orçamento é gerado para a obra.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            <div className="space-y-1.5">
              <Label>Nome da obra</Label>
              <Input
                placeholder="Ex.: Ampliação Ala Cirúrgica"
                value={obraForm.nome}
                onChange={(e) => setObraForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de empreendimento</Label>
                <Select value={obraForm.tipo} onValueChange={(v) => setObraForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposEmp.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Área (m²)</Label>
                <Input
                  type="number"
                  value={obraForm.area}
                  onChange={(e) => setObraForm((f) => ({ ...f, area: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={obraForm.cidade} onChange={(e) => setObraForm((f) => ({ ...f, cidade: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Input maxLength={2} value={obraForm.uf} onChange={(e) => setObraForm((f) => ({ ...f, uf: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Pavimentos</Label>
                <Input
                  type="number"
                  value={obraForm.pavimentos}
                  onChange={(e) => setObraForm((f) => ({ ...f, pavimentos: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Padrão construtivo</Label>
                <Select value={obraForm.padrao} onValueChange={(v) => setObraForm((f) => ({ ...f, padrao: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Econômico", "Médio", "Alto", "Luxo"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fase do projeto</Label>
                <Select value={obraForm.fase} onValueChange={(v) => setObraForm((f) => ({ ...f, fase: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Estudo preliminar", "Anteprojeto", "Executivo", "As built"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Urgência</Label>
                <Select value={obraForm.urgencia} onValueChange={(v) => setObraForm((f) => ({ ...f, urgencia: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Baixa", "Normal", "Alta", "Crítica"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Repetitividade de unidades</Label>
                <Select value={obraForm.repetitividade} onValueChange={(v) => setObraForm((f) => ({ ...f, repetitividade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Não se aplica", "Baixa", "Média", "Alta"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input value={obraForm.endereco} onChange={(e) => setObraForm((f) => ({ ...f, endereco: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={obraForm.observacoes} onChange={(e) => setObraForm((f) => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => { setObraFormOpen(false); setEditandoObraId(null) }}>
              Cancelar
            </Button>
            <Button onClick={salvarObra} disabled={salvandoObra}>
              {salvandoObra ? "Salvando..." : editandoObraId ? "Salvar alterações" : "Salvar obra"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Confirmação de arquivamento */}
      <AlertDialog open={confirmarArquivar} onOpenChange={(o) => !arquivando && setConfirmarArquivar(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {sel ? (
                <>
                  O cliente{" "}
                  <span className="font-medium text-foreground">{sel.razaoSocial}</span>{" "}
                  deixará de aparecer na lista. O histórico de propostas é preservado e você pode reativá-lo depois.
                </>
              ) : (
                "O cliente deixará de aparecer na lista."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={arquivando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                arquivarSelecionado()
              }}
              disabled={arquivando}
            >
              {arquivando ? "Arquivando..." : "Arquivar cliente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
