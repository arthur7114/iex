"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, Plus, FileText, MoreHorizontal, Download } from "lucide-react"
import { Shell } from "@/components/shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  listarDocumentos,
  criarDocumento,
  definirStatusDocumento,
  excluirDocumento,
  urlDocumento,
} from "@/lib/db/documentos"
import { uploadArquivo } from "@/lib/actions/uploads"
import { getUsuarioAtual } from "@/lib/db/usuarios"
import type { Documento } from "@/lib/db/types"
import { toast } from "sonner"

export default function BaseConhecimentoPage() {
  const [q, setQ] = useState("")
  const [tipo, setTipo] = useState("Todos")

  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [carregando, setCarregando] = useState(true)

  const [dialogAberto, setDialogAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [novoNome, setNovoNome] = useState("")
  const [novoTipo, setNovoTipo] = useState("")
  const [novaDisciplina, setNovaDisciplina] = useState("")
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null)
  const arquivoInputRef = useRef<HTMLInputElement>(null)

  async function recarregar() {
    setCarregando(true)
    try {
      const docs = await listarDocumentos()
      setDocumentos(docs)
    } catch {
      toast.error("Não foi possível carregar os documentos.")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    recarregar()
  }, [])

  const tipos = useMemo(
    () => ["Todos", ...Array.from(new Set(documentos.map((d) => d.tipo).filter(Boolean)))],
    [documentos],
  )

  const filtered = useMemo(() => {
    return documentos.filter((d) => {
      const mq = d.nome.toLowerCase().includes(q.toLowerCase())
      const mt = tipo === "Todos" || d.tipo === tipo
      return mq && mt
    })
  }, [documentos, q, tipo])

  function abrirNovoDocumento() {
    setNovoNome("")
    setNovoTipo("")
    setNovaDisciplina("")
    setNovoArquivo(null)
    if (arquivoInputRef.current) arquivoInputRef.current.value = ""
    setDialogAberto(true)
  }

  async function salvarDocumento() {
    if (!novoNome.trim()) {
      toast.error("Informe o nome do documento.")
      return
    }
    setSalvando(true)
    try {
      let arquivoPath: string | undefined
      let arquivoMime: string | undefined
      let arquivoTamanho: number | undefined

      if (novoArquivo) {
        const fd = new FormData()
        fd.append("file", novoArquivo)
        const { path, error } = await uploadArquivo("kb", "doc", fd)
        if (error) {
          toast.error("Não foi possível enviar o arquivo.")
          return
        }
        arquivoPath = path
        arquivoMime = novoArquivo.type
        arquivoTamanho = novoArquivo.size
      }

      const usuario = await getUsuarioAtual()
      await criarDocumento({
        nome: novoNome.trim(),
        tipo: novoTipo.trim(),
        disciplina: novaDisciplina.trim(),
        responsavelNome: usuario?.nome,
        arquivoPath,
        arquivoMime,
        arquivoTamanho,
      })
      toast.success("Documento criado.")
      setDialogAberto(false)
      await recarregar()
    } catch {
      toast.error("Não foi possível criar o documento.")
    } finally {
      setSalvando(false)
    }
  }

  async function baixarDocumento(d: Documento) {
    try {
      const url = await urlDocumento(d.id)
      if (url) {
        window.open(url, "_blank")
      } else {
        toast("Documento sem arquivo anexado.")
      }
    } catch {
      toast.error("Não foi possível abrir o arquivo.")
    }
  }

  async function alternarStatus(d: Documento) {
    const novoStatus: Documento["status"] = d.status === "Ativo" ? "Inativo" : "Ativo"
    try {
      await definirStatusDocumento(d.id, novoStatus)
      toast.success(novoStatus === "Ativo" ? "Documento ativado." : "Documento inativado.")
      await recarregar()
    } catch {
      toast.error("Não foi possível atualizar o status.")
    }
  }

  async function removerDocumento(d: Documento) {
    try {
      await excluirDocumento(d.id)
      toast.success("Documento excluído.")
      await recarregar()
    } catch {
      toast.error("Não foi possível excluir o documento.")
    }
  }

  return (
    <Shell breadcrumb={["IEX", "Base de conhecimento"]}>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Base de conhecimento
            </h1>
            <p className="text-sm text-muted-foreground">
              Modelos, escopos padrão e referências técnicas reutilizáveis nas propostas.
            </p>
          </div>
          <Button onClick={abrirNovoDocumento}>
            <Plus className="h-4 w-4" />
            Novo documento
          </Button>
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar documentos..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === "Todos" ? "Todos os tipos" : t}
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
                  <TableHead>Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando && documentos.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Carregando documentos...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhum documento encontrado.
                    </TableCell>
                  </TableRow>
                ) : null}
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-foreground">{d.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.tipo}</TableCell>
                    <TableCell className="text-muted-foreground">{d.disciplina}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.atualizado ? new Date(d.atualizado).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.responsavel}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="font-normal"
                        data-active={d.status === "Ativo"}
                      >
                        <span
                          className={
                            d.status === "Ativo"
                              ? "mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[oklch(0.55_0.1_155)]"
                              : "mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                          }
                        />
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Ações</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => baixarDocumento(d)}>
                            <Download className="h-4 w-4" />
                            Abrir arquivo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => alternarStatus(d)}>
                            {d.status === "Ativo" ? "Inativar" : "Ativar"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => removerDocumento(d)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo documento</DialogTitle>
            <DialogDescription>
              Cadastre uma referência reutilizável na base de conhecimento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="doc-nome">Nome</Label>
              <Input
                id="doc-nome"
                placeholder="Nome do documento"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-tipo">Tipo</Label>
              <Input
                id="doc-tipo"
                placeholder="Ex: Modelo, Escopo, Referência"
                value={novoTipo}
                onChange={(e) => setNovoTipo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-disciplina">Disciplina</Label>
              <Input
                id="doc-disciplina"
                placeholder="Ex: Elétrica, Hidráulica, Geral"
                value={novaDisciplina}
                onChange={(e) => setNovaDisciplina(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-arquivo">Arquivo (opcional)</Label>
              <Input
                id="doc-arquivo"
                type="file"
                ref={arquivoInputRef}
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                onChange={(e) => setNovoArquivo(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                PDF, documentos do Word ou imagens.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={salvarDocumento} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  )
}
