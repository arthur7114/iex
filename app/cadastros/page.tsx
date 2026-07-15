"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, GripVertical, Trash2, Check, X, Star } from "lucide-react"
import { Shell } from "@/components/shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  listarDisciplinas,
  criarDisciplina,
  atualizarDisciplina,
  definirAtivoDisciplina,
} from "@/lib/db/disciplinas"
import {
  listarOpcoes,
  criarOpcao,
  atualizarOpcao,
  desativarOpcao,
} from "@/lib/db/lookups"
import {
  listarModelos,
  criarModelo,
  atualizarModelo,
  excluirModelo,
  type ModeloProposta,
} from "@/lib/db/modelos"
import type { Disciplina, OpcaoRef, CategoriaRef } from "@/lib/db/types"
import { formatBRL } from "@/lib/mock-data"
import { toast } from "sonner"

type DisciplinaForm = {
  nome: string
  descricao: string
  valorBaseM2: string
  valorMinimo: string
  exigeAprovacao: boolean
}

const emptyDisciplinaForm: DisciplinaForm = {
  nome: "",
  descricao: "",
  valorBaseM2: "",
  valorMinimo: "",
  exigeAprovacao: false,
}

type ModeloForm = {
  nome: string
  premissas: string
  exclusoes: string
  formaPagamentoPadrao: string
  prazoExecucaoPadrao: string
  validadePadrao: string
  padrao: boolean
}

const emptyModeloForm: ModeloForm = {
  nome: "",
  premissas: "",
  exclusoes: "",
  formaPagamentoPadrao: "",
  prazoExecucaoPadrao: "",
  validadePadrao: "",
  padrao: false,
}

export default function CadastrosPage() {
  const [tab, setTab] = useState("disciplinas")
  const [carregando, setCarregando] = useState(true)

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [tiposEmpreendimento, setTiposEmpreendimento] = useState<OpcaoRef[]>([])
  const [motivosPerda, setMotivosPerda] = useState<OpcaoRef[]>([])
  const [formasPagamento, setFormasPagamento] = useState<OpcaoRef[]>([])
  const [modelos, setModelos] = useState<ModeloProposta[]>([])

  // ---- Disciplina dialog (criar / editar) ----
  const [dialogAberto, setDialogAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<DisciplinaForm>(emptyDisciplinaForm)
  const [salvando, setSalvando] = useState(false)

  // ---- Modelo dialog (criar / editar) ----
  const [modeloDialogAberto, setModeloDialogAberto] = useState(false)
  const [modeloEditandoId, setModeloEditandoId] = useState<string | null>(null)
  const [modeloForm, setModeloForm] = useState<ModeloForm>(emptyModeloForm)
  const [salvandoModelo, setSalvandoModelo] = useState(false)

  // ---- recarregar por seção ----
  async function recarregarDisciplinas() {
    try {
      setDisciplinas(await listarDisciplinas(true))
    } catch {
      toast.error("Não foi possível carregar as disciplinas.")
    }
  }

  async function recarregarTipos() {
    try {
      setTiposEmpreendimento(await listarOpcoes("tipo_empreendimento", true))
    } catch {
      toast.error("Não foi possível carregar os tipos de empreendimento.")
    }
  }

  async function recarregarMotivos() {
    try {
      setMotivosPerda(await listarOpcoes("motivo_perda", true))
    } catch {
      toast.error("Não foi possível carregar os motivos de perda.")
    }
  }

  async function recarregarFormas() {
    try {
      setFormasPagamento(await listarOpcoes("forma_pagamento", true))
    } catch {
      toast.error("Não foi possível carregar as formas de pagamento.")
    }
  }

  async function recarregarModelos() {
    try {
      setModelos(await listarModelos())
    } catch {
      toast.error("Não foi possível carregar os modelos de proposta.")
    }
  }

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      try {
        const [d, t, m, f, mod] = await Promise.all([
          listarDisciplinas(true),
          listarOpcoes("tipo_empreendimento", true),
          listarOpcoes("motivo_perda", true),
          listarOpcoes("forma_pagamento", true),
          listarModelos(),
        ])
        if (!ativo) return
        setDisciplinas(d)
        setTiposEmpreendimento(t)
        setMotivosPerda(m)
        setFormasPagamento(f)
        setModelos(mod)
      } catch {
        if (ativo) toast.error("Não foi possível carregar os cadastros.")
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  // ---- Disciplina handlers ----
  function abrirNovaDisciplina() {
    setEditandoId(null)
    setForm(emptyDisciplinaForm)
    setDialogAberto(true)
  }

  function abrirEdicaoDisciplina(d: Disciplina) {
    setEditandoId(d.id)
    setForm({
      nome: d.nome,
      descricao: d.descricao,
      valorBaseM2: String(d.valorBaseM2),
      valorMinimo: String(d.valorMinimo),
      exigeAprovacao: d.exigeAprovacao,
    })
    setDialogAberto(true)
  }

  async function salvarDisciplina() {
    const nome = form.nome.trim()
    if (!nome) {
      toast.error("Informe o nome da disciplina.")
      return
    }
    const valorBaseM2 = Number(form.valorBaseM2) || 0
    const valorMinimo = Number(form.valorMinimo) || 0
    setSalvando(true)
    try {
      if (editandoId) {
        await atualizarDisciplina(editandoId, {
          nome,
          descricao: form.descricao.trim(),
          valorBaseM2,
          valorMinimo,
          exigeAprovacao: form.exigeAprovacao,
        })
        toast.success("Disciplina atualizada.")
      } else {
        await criarDisciplina({
          nome,
          descricao: form.descricao.trim(),
          valorBaseM2,
          valorMinimo,
          exigeAprovacao: form.exigeAprovacao,
          escopoPadrao: [],
        })
        toast.success("Disciplina criada.")
      }
      setDialogAberto(false)
      await recarregarDisciplinas()
    } catch {
      toast.error("Não foi possível salvar a disciplina.")
    } finally {
      setSalvando(false)
    }
  }

  async function desativarDisciplina(d: Disciplina) {
    try {
      await definirAtivoDisciplina(d.id, false)
      toast.success("Disciplina desativada.")
      await recarregarDisciplinas()
    } catch {
      toast.error("Não foi possível desativar a disciplina.")
    }
  }

  // ---- Modelo handlers ----
  function abrirNovoModelo() {
    setModeloEditandoId(null)
    setModeloForm(emptyModeloForm)
    setModeloDialogAberto(true)
  }

  function abrirEdicaoModelo(m: ModeloProposta) {
    setModeloEditandoId(m.id)
    setModeloForm({
      nome: m.nome,
      premissas: m.premissas ?? "",
      exclusoes: m.exclusoes ?? "",
      formaPagamentoPadrao: m.formaPagamentoPadrao ?? "",
      prazoExecucaoPadrao: m.prazoExecucaoPadrao ?? "",
      validadePadrao: m.validadePadrao ?? "",
      padrao: m.padrao,
    })
    setModeloDialogAberto(true)
  }

  async function salvarModelo() {
    const nome = modeloForm.nome.trim()
    if (!nome) {
      toast.error("Informe o nome do modelo.")
      return
    }
    const payload = {
      nome,
      premissas: modeloForm.premissas.trim() || null,
      exclusoes: modeloForm.exclusoes.trim() || null,
      formaPagamentoPadrao: modeloForm.formaPagamentoPadrao.trim() || null,
      prazoExecucaoPadrao: modeloForm.prazoExecucaoPadrao.trim() || null,
      validadePadrao: modeloForm.validadePadrao.trim() || null,
      padrao: modeloForm.padrao,
    }
    setSalvandoModelo(true)
    try {
      if (modeloEditandoId) {
        await atualizarModelo(modeloEditandoId, payload)
        toast.success("Modelo atualizado.")
      } else {
        await criarModelo(payload)
        toast.success("Modelo criado.")
      }
      setModeloDialogAberto(false)
      await recarregarModelos()
    } catch {
      toast.error("Não foi possível salvar o modelo.")
    } finally {
      setSalvandoModelo(false)
    }
  }

  async function removerModelo(m: ModeloProposta) {
    try {
      await excluirModelo(m.id)
      toast.success("Modelo excluído.")
      await recarregarModelos()
    } catch {
      toast.error("Não foi possível excluir o modelo.")
    }
  }

  return (
    <Shell breadcrumb={["IEX", "Cadastros"]}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cadastros</h1>
          <p className="text-sm text-muted-foreground">
            Parâmetros e tabelas base usados na geração de propostas.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="disciplinas">Disciplinas</TabsTrigger>
            <TabsTrigger value="tipos">Tipos de empreendimento</TabsTrigger>
            <TabsTrigger value="motivos">Motivos de perda</TabsTrigger>
            <TabsTrigger value="pagamento">Formas de pagamento</TabsTrigger>
            <TabsTrigger value="modelos">Modelos</TabsTrigger>
          </TabsList>

          <TabsContent value="disciplinas" className="mt-5">
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Disciplinas técnicas</h3>
                  <p className="text-sm text-muted-foreground">
                    Valores de referência por m² usados no cálculo automático.
                  </p>
                </div>
                <Button size="sm" onClick={abrirNovaDisciplina}>
                  <Plus className="h-4 w-4" />
                  Nova disciplina
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10" />
                      <TableHead>Disciplina</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor / m²</TableHead>
                      <TableHead className="text-right">Valor mínimo</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disciplinas.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{d.nome}</TableCell>
                        <TableCell className="max-w-md text-muted-foreground">{d.descricao}</TableCell>
                        <TableCell className="text-right tabular-nums text-foreground">
                          {formatBRL(d.valorBaseM2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-foreground">
                          {formatBRL(d.valorMinimo)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => abrirEdicaoDisciplina(d)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => desativarDisciplina(d)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Desativar</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!carregando && disciplinas.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          Nenhuma disciplina cadastrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="tipos" className="mt-5">
            <OpcaoCard
              titulo="Tipos de empreendimento"
              categoria="tipo_empreendimento"
              labelAdicionar="Adicionar"
              variant="badges"
              itens={tiposEmpreendimento}
              onMudou={recarregarTipos}
            />
          </TabsContent>

          <TabsContent value="motivos" className="mt-5">
            <OpcaoCard
              titulo="Motivos de perda"
              categoria="motivo_perda"
              labelAdicionar="Adicionar"
              variant="table"
              itens={motivosPerda}
              onMudou={recarregarMotivos}
            />
          </TabsContent>

          <TabsContent value="pagamento" className="mt-5">
            <OpcaoCard
              titulo="Formas de pagamento"
              categoria="forma_pagamento"
              labelAdicionar="Adicionar"
              variant="grid"
              itens={formasPagamento}
              onMudou={recarregarFormas}
            />
          </TabsContent>

          <TabsContent value="modelos" className="mt-5">
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Modelos de proposta</h3>
                  <p className="text-sm text-muted-foreground">
                    Premissas, exclusões e padrões reutilizados na geração de propostas.
                  </p>
                </div>
                <Button size="sm" onClick={abrirNovoModelo}>
                  <Plus className="h-4 w-4" />
                  Novo modelo
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Modelo</TableHead>
                      <TableHead>Forma de pagamento</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelos.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            {m.nome}
                            {m.padrao && (
                              <Badge variant="secondary" className="gap-1 font-normal">
                                <Star className="h-3 w-3" />
                                Padrão
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.formaPagamentoPadrao || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.prazoExecucaoPadrao || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.validadePadrao || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => abrirEdicaoModelo(m)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => removerModelo(m)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Excluir</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!carregando && modelos.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          Nenhum modelo cadastrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar disciplina" : "Nova disciplina"}</DialogTitle>
            <DialogDescription>
              Cadastro unificado de disciplina, com valor base por m² e valor mínimo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="disciplina-nome">Nome</Label>
              <Input
                id="disciplina-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Arquitetura"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="disciplina-descricao">Descrição</Label>
              <Input
                id="disciplina-descricao"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Descrição da disciplina"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="disciplina-valor-m2">Valor base / m² (R$)</Label>
                <Input
                  id="disciplina-valor-m2"
                  type="number"
                  inputMode="decimal"
                  value={form.valorBaseM2}
                  onChange={(e) => setForm((f) => ({ ...f, valorBaseM2: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="disciplina-valor-minimo">Valor mínimo (R$)</Label>
                <Input
                  id="disciplina-valor-minimo"
                  type="number"
                  inputMode="decimal"
                  value={form.valorMinimo}
                  onChange={(e) => setForm((f) => ({ ...f, valorMinimo: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <Label className="cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                checked={form.exigeAprovacao}
                onChange={(e) => setForm((f) => ({ ...f, exigeAprovacao: e.target.checked }))}
              />
              Exige aprovação
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvarDisciplina} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modeloDialogAberto} onOpenChange={setModeloDialogAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modeloEditandoId ? "Editar modelo" : "Novo modelo"}</DialogTitle>
            <DialogDescription>
              Modelo de proposta com premissas, exclusões e padrões reutilizáveis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="modelo-nome">Nome</Label>
              <Input
                id="modelo-nome"
                value={modeloForm.nome}
                onChange={(e) => setModeloForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Proposta padrão residencial"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modelo-premissas">Premissas</Label>
              <Textarea
                id="modelo-premissas"
                value={modeloForm.premissas}
                onChange={(e) => setModeloForm((f) => ({ ...f, premissas: e.target.value }))}
                placeholder="Premissas consideradas na proposta"
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modelo-exclusoes">Exclusões</Label>
              <Textarea
                id="modelo-exclusoes"
                value={modeloForm.exclusoes}
                onChange={(e) => setModeloForm((f) => ({ ...f, exclusoes: e.target.value }))}
                placeholder="O que não está incluído na proposta"
                rows={4}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="modelo-forma-pagamento">Forma de pagamento padrão</Label>
                <Input
                  id="modelo-forma-pagamento"
                  value={modeloForm.formaPagamentoPadrao}
                  onChange={(e) => setModeloForm((f) => ({ ...f, formaPagamentoPadrao: e.target.value }))}
                  placeholder="Ex.: 30% entrada, 70% em 3x"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modelo-prazo">Prazo de execução padrão</Label>
                <Input
                  id="modelo-prazo"
                  value={modeloForm.prazoExecucaoPadrao}
                  onChange={(e) => setModeloForm((f) => ({ ...f, prazoExecucaoPadrao: e.target.value }))}
                  placeholder="Ex.: 90 dias"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modelo-validade">Validade padrão</Label>
              <Input
                id="modelo-validade"
                value={modeloForm.validadePadrao}
                onChange={(e) => setModeloForm((f) => ({ ...f, validadePadrao: e.target.value }))}
                placeholder="Ex.: 15 dias"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="modelo-padrao">Modelo padrão</Label>
                <p className="text-sm text-muted-foreground">Usado por padrão ao gerar novas propostas.</p>
              </div>
              <Switch
                id="modelo-padrao"
                checked={modeloForm.padrao}
                onCheckedChange={(checked) => setModeloForm((f) => ({ ...f, padrao: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModeloDialogAberto(false)} disabled={salvandoModelo}>
              Cancelar
            </Button>
            <Button onClick={salvarModelo} disabled={salvandoModelo}>
              {salvandoModelo ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Shell>
  )
}

// Seção genérica para listas de referência (tipos, motivos, formas).
// Mantém os três estilos visuais originais via prop `variant`.
function OpcaoCard({
  titulo,
  categoria,
  labelAdicionar,
  variant,
  itens,
  onMudou,
}: {
  titulo: string
  categoria: CategoriaRef
  labelAdicionar: string
  variant: "badges" | "table" | "grid"
  itens: OpcaoRef[]
  onMudou: () => Promise<void> | void
}) {
  const [novo, setNovo] = useState("")
  const [adicionando, setAdicionando] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState("")

  async function adicionar() {
    const nome = novo.trim()
    if (!nome) {
      toast.error("Informe um nome.")
      return
    }
    setAdicionando(true)
    try {
      await criarOpcao(categoria, nome)
      toast.success("Item adicionado.")
      setNovo("")
      await onMudou()
    } catch {
      toast.error("Não foi possível adicionar o item.")
    } finally {
      setAdicionando(false)
    }
  }

  function iniciarEdicao(item: OpcaoRef) {
    setEditId(item.id)
    setEditNome(item.nome)
  }

  function cancelarEdicao() {
    setEditId(null)
    setEditNome("")
  }

  async function salvarEdicao(item: OpcaoRef) {
    const nome = editNome.trim()
    if (!nome) {
      toast.error("Informe um nome.")
      return
    }
    try {
      await atualizarOpcao(categoria, item.id, { nome })
      toast.success("Item atualizado.")
      cancelarEdicao()
      await onMudou()
    } catch {
      toast.error("Não foi possível atualizar o item.")
    }
  }

  async function remover(item: OpcaoRef) {
    try {
      await desativarOpcao(categoria, item.id)
      toast.success("Item removido.")
      await onMudou()
    } catch {
      toast.error("Não foi possível remover o item.")
    }
  }

  const addRow = (
    <div className="flex items-center gap-2">
      <Input
        value={novo}
        onChange={(e) => setNovo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") adicionar()
        }}
        placeholder="Novo item"
        className="h-8 w-48"
      />
      <Button size="sm" variant="outline" onClick={adicionar} disabled={adicionando}>
        <Plus className="h-4 w-4" />
        {labelAdicionar}
      </Button>
    </div>
  )

  if (variant === "table") {
    return (
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          {addRow}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Item</TableHead>
                <TableHead className="w-28 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">
                    {editId === item.id ? (
                      <Input
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") salvarEdicao(item)
                          if (e.key === "Escape") cancelarEdicao()
                        }}
                        className="h-8 w-64"
                        autoFocus
                      />
                    ) : (
                      item.nome
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <OpcaoAcoes
                      editando={editId === item.id}
                      onEditar={() => iniciarEdicao(item)}
                      onSalvar={() => salvarEdicao(item)}
                      onCancelar={cancelarEdicao}
                      onRemover={() => remover(item)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    )
  }

  if (variant === "grid") {
    return (
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          {addRow}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {itens.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
            >
              {editId === item.id ? (
                <Input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") salvarEdicao(item)
                    if (e.key === "Escape") cancelarEdicao()
                  }}
                  className="h-8"
                  autoFocus
                />
              ) : (
                <span className="text-foreground">{item.nome}</span>
              )}
              <OpcaoAcoes
                editando={editId === item.id}
                onEditar={() => iniciarEdicao(item)}
                onSalvar={() => salvarEdicao(item)}
                onCancelar={cancelarEdicao}
                onRemover={() => remover(item)}
              />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  // variant === "badges"
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        {addRow}
      </div>
      <div className="flex flex-wrap gap-2">
        {itens.map((item) =>
          editId === item.id ? (
            <div key={item.id} className="flex items-center gap-1">
              <Input
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarEdicao(item)
                  if (e.key === "Escape") cancelarEdicao()
                }}
                className="h-8 w-40"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => salvarEdicao(item)}>
                <Check className="h-3.5 w-3.5" />
                <span className="sr-only">Salvar</span>
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelarEdicao}>
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Cancelar</span>
              </Button>
            </div>
          ) : (
            <Badge key={item.id} variant="secondary" className="gap-2 px-3 py-1.5 font-normal">
              {item.nome}
              <button
                type="button"
                onClick={() => iniciarEdicao(item)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                <span className="sr-only">Editar</span>
              </button>
              <button
                type="button"
                onClick={() => remover(item)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-3 w-3" />
                <span className="sr-only">Remover</span>
              </button>
            </Badge>
          ),
        )}
      </div>
    </Card>
  )
}

function OpcaoAcoes({
  editando,
  onEditar,
  onSalvar,
  onCancelar,
  onRemover,
}: {
  editando: boolean
  onEditar: () => void
  onSalvar: () => void
  onCancelar: () => void
  onRemover: () => void
}) {
  if (editando) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSalvar}>
          <Check className="h-3.5 w-3.5" />
          <span className="sr-only">Salvar</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCancelar}>
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Cancelar</span>
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditar}>
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">Editar</span>
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onRemover}>
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Remover</span>
      </Button>
    </div>
  )
}
