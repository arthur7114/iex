"use client"

import { useEffect, useMemo, useState } from "react"
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
} from "lucide-react"
import { Shell } from "@/components/shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import type { Cliente, Proposta, OpcaoRef } from "@/lib/db/types"
import { toast } from "sonner"

export default function ClientesPage() {
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
      try {
        const [cs, ps, os, prfs] = await Promise.all([
          listarClientesComMetricas(),
          listarPropostas(),
          listarOpcoes("origem_cliente"),
          listarOpcoes("perfil_cliente"),
        ])
        if (!ativo) return
        setClientes(cs)
        setPropostas(ps)
        setOrigens(os)
        setPerfis(prfs)
      } catch {
        if (ativo) toast.error("Não foi possível carregar os clientes.")
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

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
      toast.success("Cliente arquivado.")
      setOpen(false)
      await recarregar()
    } catch {
      toast.error("Não foi possível arquivar o cliente.")
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
                {filtered.map((c) => (
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
                ))}
                {!carregando && filtered.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {carregando && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Carregando clientes...
                    </TableCell>
                  </TableRow>
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
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Histórico de propostas</h3>
                  <div className="space-y-2">
                    {propostasDoCliente(sel.id).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{p.numero}</p>
                            <p className="text-xs text-muted-foreground">{p.empreendimento}</p>
                          </div>
                        </div>
                        <span className="text-sm font-medium tabular-nums text-foreground">
                          {formatBRL(p.valorFinal)}
                        </span>
                      </div>
                    ))}
                    {propostasDoCliente(sel.id).length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma proposta registrada para este cliente.
                      </p>
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
                  onClick={arquivarSelecionado}
                  disabled={arquivando}
                >
                  <Archive className="h-4 w-4" />
                  {arquivando ? "Arquivando..." : "Arquivar"}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
                <Button onClick={() => toast.success("Abrindo nova proposta para o cliente.")}>
                  Nova proposta
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
