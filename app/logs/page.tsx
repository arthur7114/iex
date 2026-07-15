"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Download, AlertTriangle, RotateCcw } from "lucide-react"
import { Shell } from "@/components/shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(false)
    Promise.all([listarLogs(200), listarUsuariosLog()])
      .then(([logsData, usuariosData]) => {
        if (!ativo) return
        setLogs(logsData)
        setResponsaveis(usuariosData)
      })
      .catch(() => {
        if (!ativo) return
        setErro(true)
        toast.error("Não foi possível carregar os logs.")
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [tentativa])

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

  // Exporta os logs atualmente filtrados como CSV, gerado no cliente a partir dos dados em memória.
  function exportarCsv() {
    if (filtered.length === 0) {
      toast("Nenhum registro para exportar.")
      return
    }
    const cabecalho = ["Data", "Hora", "Usuário", "Ação", "Entidade", "Detalhe", "Origem"]
    const escapar = (valor: string) => `"${String(valor ?? "").replace(/"/g, '""')}"`
    const linhas = filtered.map((l) =>
      [l.data, l.hora, l.usuario, l.acao, l.entidade, l.detalhe, l.origem].map(escapar).join(","),
    )
    const csv = "﻿" + [cabecalho.map(escapar).join(","), ...linhas].join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "logs.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("Exportação concluída.")
  }

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
          <Button variant="outline" onClick={exportarCsv} disabled={carregando || filtered.length === 0}>
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
                {carregando ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : erro ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="py-12">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <AlertTriangle className="h-6 w-6 text-danger" />
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            Não foi possível carregar os logs
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
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      {logs.length === 0
                        ? "Nenhuma ação foi registrada ainda."
                        : "Nenhum registro corresponde aos filtros aplicados."}
                    </TableCell>
                  </TableRow>
                ) : (
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </Shell>
  )
}
