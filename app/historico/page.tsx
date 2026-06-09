"use client"

import { useState } from "react"
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react"
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
import { formatBRL } from "@/lib/mock-data"
import { toast } from "sonner"

const importados = [
  { numero: "HIST-2024-018", cliente: "Hospital São Lucas", tipo: "Hospital", valor: 98000, status: "ok" },
  { numero: "HIST-2024-022", cliente: "Grupo Atlântico Hotéis", tipo: "Hotel", valor: 312000, status: "ok" },
  { numero: "HIST-2024-031", cliente: "Clínica Vida Plena", tipo: "Clínica", valor: 41500, status: "revisar" },
  { numero: "HIST-2024-040", cliente: "Indústria Nordeste Foods", tipo: "Indústria", valor: 487000, status: "ok" },
  { numero: "HIST-2024-055", cliente: "Condomínio Reserva", tipo: "Condomínio", valor: 22300, status: "revisar" },
  { numero: "HIST-2024-061", cliente: "Arq. Mariana Teixeira", tipo: "Residencial", valor: 19800, status: "ok" },
]

export default function HistoricoPage() {
  const [fase, setFase] = useState<"upload" | "processando" | "concluido">("upload")
  const [progresso, setProgresso] = useState(0)

  function iniciar() {
    setFase("processando")
    setProgresso(0)
    const timer = setInterval(() => {
      setProgresso((p) => {
        if (p >= 100) {
          clearInterval(timer)
          setFase("concluido")
          return 100
        }
        return p + 10
      })
    }, 180)
  }

  return (
    <Shell breadcrumb={["IEX", "Histórico"]}>
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Importação de histórico
          </h1>
          <p className="text-sm text-muted-foreground">
            Carregue propostas anteriores para alimentar as sugestões de preço da IA.
          </p>
        </div>

        {fase === "upload" && (
          <Card className="p-6">
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-secondary/30 px-6 py-14 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Arraste uma planilha ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: .xlsx, .csv · até 10 MB
                </p>
              </div>
              <Button onClick={iniciar}>
                <FileSpreadsheet className="h-4 w-4" />
                Selecionar arquivo
              </Button>
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
                <p className="text-sm font-medium text-foreground">propostas_2024.xlsx</p>
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
                <p className="text-xs text-muted-foreground">Registros importados</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">142</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Validados</p>
                <p className="text-2xl font-semibold tabular-nums text-[oklch(0.45_0.1_155)]">128</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Requerem revisão</p>
                <p className="text-2xl font-semibold tabular-nums text-[oklch(0.55_0.13_70)]">14</p>
              </Card>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Pré-visualização</h3>
                  <p className="text-sm text-muted-foreground">
                    Confira os registros antes de confirmar a importação.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setFase("upload")}>
                    Descartar
                  </Button>
                  <Button size="sm" onClick={() => toast.success("Histórico importado com sucesso.")}>
                    Confirmar importação
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Identificador</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importados.map((r) => (
                      <TableRow key={r.numero}>
                        <TableCell className="font-medium text-foreground">{r.numero}</TableCell>
                        <TableCell className="text-muted-foreground">{r.cliente}</TableCell>
                        <TableCell className="text-muted-foreground">{r.tipo}</TableCell>
                        <TableCell className="text-right tabular-nums text-foreground">
                          {formatBRL(r.valor)}
                        </TableCell>
                        <TableCell>
                          {r.status === "ok" ? (
                            <Badge variant="secondary" className="gap-1 font-normal">
                              <CheckCircle2 className="h-3 w-3 text-[oklch(0.5_0.1_155)]" />
                              Validado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 font-normal">
                              <AlertTriangle className="h-3 w-3 text-[oklch(0.6_0.13_70)]" />
                              Revisar
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
