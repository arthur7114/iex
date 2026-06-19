"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Download } from "lucide-react"
import { Shell } from "@/components/shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listarLogs, listarUsuariosLog } from "@/lib/db/logs"
import type { LogEntry } from "@/lib/db/types"
import { toast } from "sonner"

export default function LogsPage() {
  const [q, setQ] = useState("")
  const [usuario, setUsuario] = useState("Todos")
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [responsaveis, setResponsaveis] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    Promise.all([listarLogs(200), listarUsuariosLog()])
      .then(([logsData, usuariosData]) => {
        if (!ativo) return
        setLogs(logsData)
        setResponsaveis(usuariosData)
      })
      .catch(() => {
        toast.error("Não foi possível carregar os logs.")
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const mq =
        l.acao.toLowerCase().includes(q.toLowerCase()) ||
        l.entidade.toLowerCase().includes(q.toLowerCase()) ||
        l.detalhe.toLowerCase().includes(q.toLowerCase())
      const mu = usuario === "Todos" || l.usuario === usuario
      return mq && mu
    })
  }, [logs, q, usuario])

  return (
    <Shell breadcrumb={["IEX", "Logs"]}>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Logs de auditoria
            </h1>
            <p className="text-sm text-muted-foreground">
              Registro cronológico de ações realizadas na plataforma.
            </p>
          </div>
          <Button variant="outline" onClick={() => toast.success("Exportação iniciada.")}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por ação, entidade ou detalhe..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={usuario} onValueChange={setUsuario}>
              <SelectTrigger className="sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os usuários</SelectItem>
                {responsaveis.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
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
                  <TableHead className="whitespace-nowrap">Data / hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Detalhe</TableHead>
                  <TableHead className="text-right">Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!carregando &&
                  filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(l.data).toLocaleDateString("pt-BR")} · {l.hora}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{l.usuario}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {l.acao}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{l.entidade}</TableCell>
                    <TableCell className="max-w-xs text-muted-foreground">{l.detalhe}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {l.origem}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </Shell>
  )
}
