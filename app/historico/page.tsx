"use client"

import { useRef, useState } from "react"
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Sparkles, Download } from "lucide-react"
import Papa from "papaparse"
import { Shell } from "@/components/shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COLUNAS_PADRAO,
  COLUNAS_OBRIGATORIAS,
  csvModelo,
  validarLinhas,
  importarHistorico,
  type LinhaImport,
} from "@/lib/db/importacao"
import { getUsuarioAtual } from "@/lib/db/usuarios"
import { toast } from "sonner"

const OBRIGATORIAS = new Set<string>(COLUNAS_OBRIGATORIAS)

export default function HistoricoPage() {
  const [fase, setFase] = useState<"upload" | "processando" | "concluido">("upload")
  const [progresso, setProgresso] = useState(0)
  const [nomeArquivo, setNomeArquivo] = useState("")
  const [linhas, setLinhas] = useState<LinhaImport[]>([])
  const [importando, setImportando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validas = linhas.filter((l) => l.erros.length === 0).length
  const comErro = linhas.length - validas

  function baixarModelo() {
    const blob = new Blob([csvModelo()], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "modelo-importacao-iex.csv"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function parseCsv(text: string): Record<string, string>[] {
    // Auto-detecta o delimitador; se só identificar 1 coluna, reprocessa com ";".
    let result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    })
    if ((result.meta.fields?.length ?? 0) <= 1) {
      result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: ";",
      })
    }
    return result.data ?? []
  }

  async function aoSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Permite reselecionar o mesmo arquivo depois de um descarte.
    e.target.value = ""
    if (!file) return

    setNomeArquivo(file.name)
    setFase("processando")
    setProgresso(15)

    try {
      const text = await file.text()
      setProgresso(55)
      const rows = parseCsv(text)
      const validadas = validarLinhas(rows)
      setProgresso(100)

      if (!validadas.length) {
        toast.error("Nenhuma linha encontrada no arquivo.")
        descartar()
        return
      }

      setLinhas(validadas)
      setFase("concluido")
    } catch {
      toast.error("Não foi possível ler o arquivo. Verifique se é um CSV válido.")
      descartar()
    }
  }

  function descartar() {
    setFase("upload")
    setProgresso(0)
    setNomeArquivo("")
    setLinhas([])
  }

  async function confirmar() {
    if (importando) return
    setImportando(true)
    try {
      const usuario = await getUsuarioAtual()
      const r = await importarHistorico(linhas, usuario?.id ?? null)
      toast.success(
        `${r.criadas} propostas importadas${r.ignoradas ? `, ${r.ignoradas} ignoradas` : ""}`,
      )
      descartar()
    } catch {
      toast.error("Falha ao importar o histórico. Tente novamente.")
    } finally {
      setImportando(false)
    }
  }

  return (
    <Shell breadcrumb={["IEX", "Histórico"]}>
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Importação de histórico
            </h1>
            <p className="text-sm text-muted-foreground">
              Carregue propostas anteriores para alimentar as sugestões de preço da IA.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={baixarModelo}>
            <Download className="h-4 w-4" />
            Baixar modelo
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={aoSelecionarArquivo}
        />

        {fase === "upload" && (
          <Card className="p-6">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-secondary/30 px-6 py-14 text-center transition-colors hover:border-primary/40 hover:bg-secondary/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Clique para selecionar uma planilha
                </p>
                <p className="text-xs text-muted-foreground">
                  Formato aceito: .csv (delimitado por ";" ou ",")
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                Selecionar arquivo
              </span>
            </button>

            <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">Colunas esperadas (cabeçalho do CSV)</p>
              <div className="flex flex-wrap gap-1.5">
                {COLUNAS_PADRAO.map((col) => (
                  <Badge
                    key={col}
                    variant="secondary"
                    className="gap-1 font-normal tabular-nums"
                  >
                    {col}
                    {OBRIGATORIAS.has(col) && <span className="text-danger">*</span>}
                  </Badge>
                ))}
              </div>
              <p className="mt-2">
                <span className="text-danger">*</span> Campos obrigatórios:{" "}
                {COLUNAS_OBRIGATORIAS.join(", ")}.
              </p>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Quanto mais propostas históricas forem importadas, mais precisas e confiáveis serão
                as sugestões de preço por disciplina.
              </p>
            </div>
          </Card>
        )}

        {fase === "processando" && (
          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{nomeArquivo || "Arquivo"}</p>
                <p className="text-xs text-muted-foreground">Processando e validando registros...</p>
              </div>
              <span className="text-sm font-medium tabular-nums text-foreground">{progresso}%</span>
            </div>
            <Progress value={progresso} />
          </Card>
        )}

        {fase === "concluido" && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Registros no arquivo</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {linhas.length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Linhas válidas</p>
                <p className="text-2xl font-semibold tabular-nums text-[oklch(0.45_0.1_155)]">
                  {validas}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Com erro</p>
                <p className="text-2xl font-semibold tabular-nums text-[oklch(0.55_0.13_70)]">
                  {comErro}
                </p>
              </Card>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Pré-visualização</h3>
                  <p className="text-sm text-muted-foreground">
                    {validas} {validas === 1 ? "linha válida" : "linhas válidas"}
                    {comErro > 0 && (
                      <>
                        {", "}
                        <span className="text-danger">
                          {comErro} {comErro === 1 ? "com erro" : "com erro"}
                        </span>{" "}
                        (serão ignoradas)
                      </>
                    )}
                    . Confira antes de confirmar.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={descartar} disabled={importando}>
                    Descartar
                  </Button>
                  <Button size="sm" onClick={confirmar} disabled={importando || validas === 0}>
                    {importando ? "Importando..." : "Confirmar importação"}
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-14">Linha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l) => {
                      const temErro = l.erros.length > 0
                      const d = l.dados
                      return (
                        <TableRow key={l.linha} className={temErro ? "bg-danger/5" : undefined}>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {l.linha}
                          </TableCell>
                          <TableCell
                            className={
                              temErro
                                ? "font-medium text-danger"
                                : "font-medium text-foreground"
                            }
                          >
                            {d.cliente?.trim() || <span className="text-danger">(vazio)</span>}
                            {temErro && (
                              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs font-normal text-danger">
                                {l.erros.map((e, i) => (
                                  <li key={i}>{e}</li>
                                ))}
                              </ul>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {d.tipo_empreendimento?.trim() || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-foreground">
                            {d.valor_total?.trim() || "—"}
                          </TableCell>
                          <TableCell>
                            {temErro ? (
                              <Badge variant="secondary" className="gap-1 font-normal">
                                <AlertTriangle className="h-3 w-3 text-[oklch(0.6_0.13_70)]" />
                                Com erro
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 font-normal">
                                <CheckCircle2 className="h-3 w-3 text-[oklch(0.5_0.1_155)]" />
                                Válida
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}
      </div>
    </Shell>
  )
}
