"use client"

import { useMemo, useState } from "react"
import { Search, Plus, FileText, MoreHorizontal } from "lucide-react"
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
import { documentos } from "@/lib/mock-data"
import { toast } from "sonner"

export default function BaseConhecimentoPage() {
  const [q, setQ] = useState("")
  const [tipo, setTipo] = useState("Todos")

  const tipos = useMemo(() => ["Todos", ...Array.from(new Set(documentos.map((d) => d.tipo)))], [])

  const filtered = useMemo(() => {
    return documentos.filter((d) => {
      const mq = d.nome.toLowerCase().includes(q.toLowerCase())
      const mt = tipo === "Todos" || d.tipo === tipo
      return mq && mt
    })
  }, [q, tipo])

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
          <Button onClick={() => toast.info("Upload de documento.")}>
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
                      {new Date(d.atualizado).toLocaleDateString("pt-BR")}
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
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Ações</span>
                      </Button>
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
