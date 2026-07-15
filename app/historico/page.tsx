"use client"

import { useMemo, useRef, useState } from "react"
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  CopyCheck,
  Sparkles,
  Download,
  RotateCcw,
} from "lucide-react"
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
  csvRelatorioErros,
  analisarLinhas,
  importarHistorico,
  statusDaLinha,
  type LinhaImport,
  type ResultadoImportacao,
} from "@/lib/db/importacao"
import { getUsuarioAtual } from "@/lib/db/usuarios"
import { toast } from "sonner"

const OBRIGATORIAS = new Set<string>(COLUNAS_OBRIGATORIAS)

type Fase = "upload" | "analisando" | "revisao" | "importando" | "resumo"

function baixarCsv(conteudo: string, nomeArquivo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function HistoricoPage() {
  const [fase, setFase] = useState<Fase>("upload")
  const [progresso, setProgresso] = useState(0)
  const [progressoRotulo, setProgressoRotulo] = useState("")
  const [nomeArquivo, setNomeArquivo] = useState("")
  const [linhas, setLinhas] = useState<LinhaImport[]>([])
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
  const [importando, setImportando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const contagem = useMemo(() => {
    let validas = 0
    let duplicadas = 0
    let comErro = 0
    for (const l of linhas) {
      const s = statusDaLinha(l)
      if (s === "valida") validas++
      else if (s === "duplicada") duplicadas++
      else comErro++
    }
    return { validas, duplicadas, comErro }
  }, [linhas])

  function baixarModelo() {
    baixarCsv(csvModelo(), "modelo-importacao-iex.csv")
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
    setResultado(null)
    setFase("analisando")
    setProgressoRotulo("Lendo e validando registros")
    setProgresso(20)

    try {
      const text = await file.text()
      setProgresso(55)
      const rows = parseCsv(text)
      if (!rows.length) {
        toast.error("Nenhuma linha encontrada no arquivo.")
        descartar()
        return
      }
      // Detecta duplicidades contra o que já foi importado antes de confirmar.
      const analisadas = await analisarLinhas(rows)
      setProgresso(100)
      setLinhas(analisadas)
      setFase("revisao")
    } catch {
      toast.error("Não foi possível ler o arquivo. Verifique se é um CSV válido.")
      descartar()
    }
  }

  function descartar() {
    setFase("upload")
    setProgresso(0)
    setProgressoRotulo("")
    setNomeArquivo("")
    setLinhas([])
    setResultado(null)
  }

  async function confirmar() {
    if (importando) return
    setImportando(true)
    setFase("importando")
    setProgresso(0)
    const totalImportaveis = contagem.validas
    setProgressoRotulo(
      totalImportaveis === 1 ? "Importando 1 proposta" : `Importando ${totalImportaveis} propostas`,
    )
    try {
      const usuario = await getUsuarioAtual()
      const r = await importarHistorico(linhas, usuario?.id ?? null, (feitas, total) => {
        setProgresso(total > 0 ? Math.round((feitas / total) * 100) : 100)
        if (total > 0) setProgressoRotulo(`Processando ${feitas} de ${total}`)
      })
      setResultado(r)
      setFase("resumo")
      if (r.criadas > 0) {
        toast.success(
          r.criadas === 1 ? "1 proposta importada" : `${r.criadas} propostas importadas`,
        )
      } else {
        toast.info("Nenhuma proposta nova foi criada.")
      }
    } catch {
      toast.error("Falha ao importar o histórico. Tente novamente.")
      setFase("revisao")
    } finally {
      setImportando(false)
    }
  }

  function baixarRelatorioErros() {
    if (!resultado?.erros.length) return
    baixarCsv(csvRelatorioErros(resultado.erros), "erros-importacao-iex.csv")
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
                  Formato aceito: .csv (delimitado por &quot;;&quot; ou &quot;,&quot;)
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
                  <Badge key={col} variant="secondary" className="gap-1 font-normal tabular-nums">
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
                as sugestões de preço por disciplina. Reimportar o mesmo arquivo não gera duplicatas.
              </p>
            </div>
          </Card>
        )}

        {(fase === "analisando" || fase === "importando") && (
          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {nomeArquivo || "Arquivo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {progressoRotulo || "Processando..."}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums text-foreground">{progresso}%</span>
            </div>
            <Progress value={progresso} />
          </Card>
        )}

        {fase === "revisao" && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Registros no arquivo</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {linhas.length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Serão criadas</p>
                <p className="text-2xl font-semibold tabular-nums text-[oklch(0.45_0.1_155)]">
                  {contagem.validas}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Duplicadas</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {contagem.duplicadas}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Com erro</p>
                <p className="text-2xl font-semibold tabular-nums text-[oklch(0.55_0.13_70)]">
                  {contagem.comErro}
                </p>
              </Card>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Pré-visualização</h3>
                  <p className="text-sm text-muted-foreground">
                    {contagem.validas} {contagem.validas === 1 ? "linha será criada" : "linhas serão criadas"}
                    {contagem.duplicadas > 0 && `, ${contagem.duplicadas} duplicada${contagem.duplicadas === 1 ? "" : "s"}`}
                    {contagem.comErro > 0 && (
                      <>
                        {", "}
                        <span className="text-danger">
                          {contagem.comErro} com erro
                        </span>
                      </>
                    )}
                    . Duplicadas e linhas com erro são ignoradas.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={descartar} disabled={importando}>
                    Descartar
                  </Button>
                  <Button
                    size="sm"
                    onClick={confirmar}
                    disabled={importando || contagem.validas === 0}
                  >
                    Confirmar importação
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-14">Linha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Empreendimento</TableHead>
                      <TableHead>Disciplinas</TableHead>
                      <TableHead className="text-right">Valor total</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l) => {
                      const s = statusDaLinha(l)
                      const d = l.dados
                      const emp =
                        d.observacoes?.trim() ||
                        (d.tipo_empreendimento?.trim()
                          ? `Importado — ${d.tipo_empreendimento.trim()}`
                          : "—")
                      const totalDisc =
                        l.disciplinasReconhecidas.length + l.disciplinasDesconhecidas.length
                      return (
                        <TableRow key={l.linha} className={s === "erro" ? "bg-danger/5" : undefined}>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {l.linha}
                          </TableCell>
                          <TableCell
                            className={
                              s === "erro" ? "font-medium text-danger" : "font-medium text-foreground"
                            }
                          >
                            {d.cliente?.trim() || <span className="text-danger">(vazio)</span>}
                            {s === "erro" && (
                              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs font-normal text-danger">
                                {l.erros.map((e, i) => (
                                  <li key={i}>{e}</li>
                                ))}
                              </ul>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-muted-foreground">
                            {emp}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {totalDisc === 0 ? (
                              "—"
                            ) : (
                              <span className="tabular-nums">
                                {totalDisc}
                                {l.disciplinasDesconhecidas.length > 0 && (
                                  <span className="ml-1 text-xs text-[oklch(0.55_0.13_70)]">
                                    ({l.disciplinasDesconhecidas.length} não cadastrada
                                    {l.disciplinasDesconhecidas.length === 1 ? "" : "s"})
                                  </span>
                                )}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-foreground">
                            {d.valor_total?.trim() || "—"}
                          </TableCell>
                          <TableCell>
                            {s === "erro" && (
                              <Badge variant="secondary" className="gap-1 font-normal">
                                <AlertTriangle className="h-3 w-3 text-[oklch(0.6_0.13_70)]" />
                                Com erro
                              </Badge>
                            )}
                            {s === "duplicada" && (
                              <Badge variant="secondary" className="gap-1 font-normal">
                                <CopyCheck className="h-3 w-3 text-muted-foreground" />
                                Duplicada
                              </Badge>
                            )}
                            {s === "valida" && (
                              <Badge variant="secondary" className="gap-1 font-normal">
                                <CheckCircle2 className="h-3 w-3 text-[oklch(0.5_0.1_155)]" />
                                Será criada
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

        {fase === "resumo" && resultado && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Registros no arquivo</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {resultado.total}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Criadas</p>
                <p className="text-2xl font-semibold tabular-nums text-[oklch(0.45_0.1_155)]">
                  {resultado.criadas}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Ignoradas (duplicadas)</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {resultado.ignoradas}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Não importadas</p>
                <p className="text-2xl font-semibold tabular-nums text-[oklch(0.55_0.13_70)]">
                  {resultado.erros.length}
                </p>
              </Card>
            </div>

            <Card className="space-y-4 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <CheckCircle2 className="h-5 w-5 text-[oklch(0.5_0.1_155)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">Importação concluída</h3>
                  <p className="text-sm text-muted-foreground">
                    {resultado.criadas} {resultado.criadas === 1 ? "proposta criada" : "propostas criadas"}
                    {resultado.ignoradas > 0 &&
                      `, ${resultado.ignoradas} ignorada${resultado.ignoradas === 1 ? "" : "s"} por já existirem`}
                    {resultado.erros.length > 0 &&
                      `, ${resultado.erros.length} não importada${resultado.erros.length === 1 ? "" : "s"}`}
                    . As propostas criadas já podem ser abertas, editadas e exportadas.
                  </p>
                </div>
              </div>

              {resultado.erros.length > 0 && (
                <div className="overflow-hidden rounded-md border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 p-3">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <AlertTriangle className="h-4 w-4 text-[oklch(0.6_0.13_70)]" />
                      <span className="font-medium">
                        {resultado.erros.length}{" "}
                        {resultado.erros.length === 1 ? "linha não importada" : "linhas não importadas"}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={baixarRelatorioErros}>
                      <Download className="h-4 w-4" />
                      Baixar relatório de erros
                    </Button>
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-14">Linha</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultado.erros.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {e.linha}
                            </TableCell>
                            <TableCell className="text-foreground">{e.cliente || "—"}</TableCell>
                            <TableCell className="text-danger">{e.motivo}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={descartar}>
                  <RotateCcw className="h-4 w-4" />
                  Importar outro arquivo
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </Shell>
  )
}
