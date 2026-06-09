"use client"

import { useState } from "react"
import { Plus, Pencil, GripVertical } from "lucide-react"
import { Shell } from "@/components/shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  disciplinas,
  tiposEmpreendimento,
  motivosPerda,
  formasPagamento,
  responsaveis,
  formatBRL,
} from "@/lib/mock-data"
import { toast } from "sonner"

export default function CadastrosPage() {
  const [tab, setTab] = useState("disciplinas")

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
            <TabsTrigger value="equipe">Equipe comercial</TabsTrigger>
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
                <Button size="sm" onClick={() => toast.info("Formulário de nova disciplina.")}>
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
                      <TableHead className="w-16" />
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
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="tipos" className="mt-5">
            <Card className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Tipos de empreendimento</h3>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tiposEmpreendimento.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-2 px-3 py-1.5 font-normal">
                    {t}
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </Badge>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="motivos" className="mt-5">
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Motivos de perda</h3>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Motivo</TableHead>
                      <TableHead className="w-24 text-right">Uso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {motivosPerda.map((m) => (
                      <TableRow key={m}>
                        <TableCell className="font-medium text-foreground">{m}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="pagamento" className="mt-5">
            <Card className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Formas de pagamento</h3>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {formasPagamento.map((f) => (
                  <div
                    key={f}
                    className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                  >
                    <span className="text-foreground">{f}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Editar</span>
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="equipe" className="mt-5">
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Equipe comercial</h3>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                  Convidar
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Nome</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead className="text-right">Acesso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responsaveis.map((r, i) => (
                      <TableRow key={r}>
                        <TableCell className="font-medium text-foreground">{r}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {i === 0 ? "Diretor Comercial" : "Analista de propostas"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="font-normal">
                            {i === 0 ? "Administrador" : "Editor"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  )
}
