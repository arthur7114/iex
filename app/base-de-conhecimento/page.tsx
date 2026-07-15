"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Search,
  Plus,
  FileText,
  MoreHorizontal,
  Download,
  Eye,
  Pencil,
  RefreshCw,
  FileWarning,
  Loader2,
} from "lucide-react"
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
  listarDocumentos,
  criarDocumento,
  atualizarDocumento,
  substituirArquivoDocumento,
  definirStatusDocumento,
  excluirDocumento,
  urlDocumento,
  type DocumentoDetalhado,
} from "@/lib/db/documentos"
import { uploadArquivo } from "@/lib/actions/uploads"
import { getUsuarioAtual } from "@/lib/db/usuarios"
import { toast } from "sonner"

const ACCEPT_ARQUIVO =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"

// Formata o tamanho do arquivo de forma legível (pt-BR).
function formatarTamanho(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null
  const unidades = ["B", "KB", "MB", "GB"]
  let valor = bytes
  let i = 0
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024
    i++
  }
  const casas = valor < 10 && i > 0 ? 1 : 0
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: casas })} ${unidades[i]}`
}

// Deriva um rótulo de formato curto (PDF, DOCX, PNG…) do mime ou do nome.
function formatarFormato(mime: string | null, nome: string): string | null {
  const ext = nome.includes(".") ? nome.split(".").pop()?.toUpperCase() : null
  if (mime) {
    if (mime === "application/pdf") return "PDF"
    if (mime.includes("wordprocessingml")) return "DOCX"
    if (mime === "application/msword") return "DOC"
    if (mime.startsWith("image/")) return mime.split("/")[1]?.toUpperCase() ?? "Imagem"
    if (mime.startsWith("text/")) return "Texto"
  }
  return ext ?? null
}

type ModoPreview = "imagem" | "pdf" | "outro" | "vazio"

function modoPreview(mime: string | null, arquivoPath: string | null): ModoPreview {
  if (!arquivoPath) return "vazio"
  if (mime?.startsWith("image/")) return "imagem"
  if (mime === "application/pdf") return "pdf"
  if (!mime && arquivoPath.toLowerCase().endsWith(".pdf")) return "pdf"
  return "outro"
}

type FormDoc = { nome: string; tipo: string; disciplina: string }
const FORM_VAZIO: FormDoc = { nome: "", tipo: "", disciplina: "" }

export default function BaseConhecimentoPage() {
  const [q, setQ] = useState("")
  const [tipo, setTipo] = useState("Todos")

  const [documentos, setDocumentos] = useState<DocumentoDetalhado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  // Dialog criar/editar
  const [dialogAberto, setDialogAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<FormDoc>(FORM_VAZIO)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [arquivoAtual, setArquivoAtual] = useState<{ formato: string | null; tamanho: string | null } | null>(null)
  const arquivoInputRef = useRef<HTMLInputElement>(null)

  // Preview
  const [previewDoc, setPreviewDoc] = useState<DocumentoDetalhado | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewCarregando, setPreviewCarregando] = useState(false)

  // Exclusão
  const [docParaExcluir, setDocParaExcluir] = useState<DocumentoDetalhado | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  async function recarregar() {
    setCarregando(true)
    setErro(false)
    try {
      setDocumentos(await listarDocumentos())
    } catch {
      setErro(true)
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
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setArquivo(null)
    setArquivoAtual(null)
    if (arquivoInputRef.current) arquivoInputRef.current.value = ""
    setDialogAberto(true)
  }

  function abrirEdicao(d: DocumentoDetalhado) {
    setEditandoId(d.id)
    setForm({ nome: d.nome, tipo: d.tipo, disciplina: d.disciplina })
    setArquivo(null)
    setArquivoAtual(
      d.arquivoPath
        ? { formato: formatarFormato(d.arquivoMime, d.nome), tamanho: formatarTamanho(d.arquivoTamanho) }
        : null,
    )
    if (arquivoInputRef.current) arquivoInputRef.current.value = ""
    setDialogAberto(true)
  }

  async function salvarDocumento() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do documento.")
      return
    }
    setSalvando(true)
    try {
      if (editandoId) {
        await atualizarDocumento(editandoId, {
          nome: form.nome.trim(),
          tipo: form.tipo.trim(),
          disciplina: form.disciplina.trim(),
        })
        if (arquivo) {
          const fd = new FormData()
          fd.append("file", arquivo)
          const { path, error } = await uploadArquivo("kb", "doc", fd)
          if (error || !path) {
            toast.error(error || "Não foi possível enviar o arquivo.")
            return
          }
          await substituirArquivoDocumento(editandoId, {
            path,
            mime: arquivo.type,
            tamanho: arquivo.size,
          })
          toast.success("Documento atualizado e arquivo substituído.")
        } else {
          toast.success("Documento atualizado.")
        }
      } else {
        let arquivoPath: string | undefined
        let arquivoMime: string | undefined
        let arquivoTamanho: number | undefined
        if (arquivo) {
          const fd = new FormData()
          fd.append("file", arquivo)
          const { path, error } = await uploadArquivo("kb", "doc", fd)
          if (error || !path) {
            toast.error(error || "Não foi possível enviar o arquivo.")
            return
          }
          arquivoPath = path
          arquivoMime = arquivo.type
          arquivoTamanho = arquivo.size
        }
        const usuario = await getUsuarioAtual()
        await criarDocumento({
          nome: form.nome.trim(),
          tipo: form.tipo.trim(),
          disciplina: form.disciplina.trim(),
          responsavelNome: usuario?.nome,
          arquivoPath,
          arquivoMime,
          arquivoTamanho,
        })
        toast.success("Documento criado.")
      }
      setDialogAberto(false)
      await recarregar()
    } catch {
      toast.error(editandoId ? "Não foi possível salvar o documento." : "Não foi possível criar o documento.")
    } finally {
      setSalvando(false)
    }
  }

  async function baixarDocumento(d: DocumentoDetalhado) {
    if (!d.arquivoPath) {
      toast("Documento sem arquivo anexado.")
      return
    }
    try {
      const url = await urlDocumento(d.id)
      if (url) window.open(url, "_blank")
      else toast.error("Não foi possível abrir o arquivo.")
    } catch {
      toast.error("Não foi possível abrir o arquivo.")
    }
  }

  async function abrirPreview(d: DocumentoDetalhado) {
    setPreviewDoc(d)
    setPreviewUrl(null)
    if (!d.arquivoPath) return
    setPreviewCarregando(true)
    try {
      setPreviewUrl(await urlDocumento(d.id))
    } catch {
      toast.error("Não foi possível carregar a pré-visualização.")
    } finally {
      setPreviewCarregando(false)
    }
  }

  async function alternarStatus(d: DocumentoDetalhado) {
    const novoStatus: DocumentoDetalhado["status"] = d.status === "Ativo" ? "Inativo" : "Ativo"
    try {
      await definirStatusDocumento(d.id, novoStatus)
      toast.success(novoStatus === "Ativo" ? "Documento ativado." : "Documento inativado.")
      await recarregar()
    } catch {
      toast.error("Não foi possível atualizar o status.")
    }
  }

  async function confirmarExclusao() {
    if (!docParaExcluir) return
    setExcluindo(true)
    try {
      await excluirDocumento(docParaExcluir.id)
      toast.success("Documento excluído.")
      setDocParaExcluir(null)
      await recarregar()
    } catch {
      toast.error("Não foi possível excluir o documento.")
    } finally {
      setExcluindo(false)
    }
  }

  const preview = previewDoc ? modoPreview(previewDoc.arquivoMime, previewDoc.arquivoPath) : "vazio"

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
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando && documentos.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
                      Carregando documentos...
                    </TableCell>
                  </TableRow>
                ) : erro ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="py-10 text-center">
                      <p className="text-sm text-muted-foreground">Não foi possível carregar os documentos.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={recarregar}>
                        Tentar novamente
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      {documentos.length === 0
                        ? "Nenhum documento cadastrado ainda."
                        : "Nenhum documento encontrado para o filtro atual."}
                    </TableCell>
                  </TableRow>
                ) : null}
                {filtered.map((d) => {
                  const formato = formatarFormato(d.arquivoMime, d.nome)
                  const tamanho = formatarTamanho(d.arquivoTamanho)
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-foreground">{d.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.tipo || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{d.disciplina}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {d.arquivoPath ? (
                          <span className="tabular-nums">
                            {formato ?? "Arquivo"}
                            {tamanho ? ` · ${tamanho}` : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {d.atualizado ? new Date(d.atualizado).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.responsavel}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal" data-active={d.status === "Ativo"}>
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
                            <DropdownMenuItem onClick={() => abrirPreview(d)}>
                              <Eye className="h-4 w-4" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => baixarDocumento(d)} disabled={!d.arquivoPath}>
                              <Download className="h-4 w-4" />
                              Abrir arquivo
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => abrirEdicao(d)}>
                              <Pencil className="h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => alternarStatus(d)}>
                              <RefreshCw className="h-4 w-4" />
                              {d.status === "Ativo" ? "Inativar" : "Ativar"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDocParaExcluir(d)}
                            >
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Criar / editar documento */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar documento" : "Novo documento"}</DialogTitle>
            <DialogDescription>
              {editandoId
                ? "Atualize nome, tipo e disciplina — e, se necessário, substitua o arquivo."
                : "Cadastre uma referência reutilizável na base de conhecimento."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="doc-nome">Nome</Label>
              <Input
                id="doc-nome"
                placeholder="Nome do documento"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-tipo">Tipo</Label>
              <Input
                id="doc-tipo"
                placeholder="Ex: Modelo, Escopo, Referência"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-disciplina">Disciplina</Label>
              <Input
                id="doc-disciplina"
                placeholder="Ex: Elétrica, Hidráulica, Geral"
                value={form.disciplina}
                onChange={(e) => setForm((f) => ({ ...f, disciplina: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-arquivo">
                {editandoId ? "Substituir arquivo (opcional)" : "Arquivo (opcional)"}
              </Label>
              {editandoId && arquivoAtual ? (
                <p className="text-xs text-muted-foreground">
                  Arquivo atual: {arquivoAtual.formato ?? "arquivo"}
                  {arquivoAtual.tamanho ? ` · ${arquivoAtual.tamanho}` : ""}. Selecione um novo para substituí-lo.
                </p>
              ) : null}
              <Input
                id="doc-arquivo"
                type="file"
                ref={arquivoInputRef}
                accept={ACCEPT_ARQUIVO}
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">PDF, documentos do Word ou imagens.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvarDocumento} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pré-visualização */}
      <Dialog open={previewDoc !== null} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-h-[92vh] gap-4 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewDoc?.nome}</DialogTitle>
            <DialogDescription>
              {previewDoc
                ? [
                    formatarFormato(previewDoc.arquivoMime, previewDoc.nome),
                    formatarTamanho(previewDoc.arquivoTamanho),
                    previewDoc.atualizado
                      ? `Atualizado em ${new Date(previewDoc.atualizado).toLocaleDateString("pt-BR")}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sem arquivo anexado"
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-64 overflow-hidden rounded-lg border border-border bg-muted/30">
            {previewCarregando ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
                Carregando pré-visualização...
              </div>
            ) : preview === "vazio" ? (
              <FallbackPreview
                titulo="Este documento não possui arquivo anexado"
                descricao="Edite o documento para anexar um arquivo."
              />
            ) : preview === "imagem" && previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={previewDoc?.nome ?? "Pré-visualização"}
                className="mx-auto max-h-[70vh] w-auto object-contain"
              />
            ) : preview === "pdf" && previewUrl ? (
              <iframe
                src={previewUrl}
                title={previewDoc?.nome ?? "Pré-visualização"}
                className="h-[70vh] w-full"
              />
            ) : (
              <FallbackPreview
                titulo="Pré-visualização indisponível para este formato"
                descricao="Abra o arquivo em uma nova aba para visualizá-lo."
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDoc(null)}>
              Fechar
            </Button>
            {previewDoc?.arquivoPath ? (
              <Button onClick={() => previewDoc && baixarDocumento(previewDoc)}>
                <Download className="h-4 w-4" />
                Abrir em nova aba
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={docParaExcluir !== null} onOpenChange={(o) => !o && setDocParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento{" "}
              <span className="font-medium text-foreground">{docParaExcluir?.nome}</span>{" "}
              será removido da base de conhecimento e deixará de aparecer nas propostas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmarExclusao()
              }}
              disabled={excluindo}
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
            >
              {excluindo ? "Excluindo..." : "Excluir documento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  )
}

function FallbackPreview({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center">
      <FileWarning className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="text-xs text-muted-foreground">{descricao}</p>
    </div>
  )
}
