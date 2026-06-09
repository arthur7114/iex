"use client"

import { useState, useEffect } from "react"
import { Shell } from "@/components/shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { getDisciplinas, saveDisciplinas } from "@/lib/storage"
import type { Disciplina } from "@/lib/mock-data"

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState("empresa")
  const [margem, setMargem] = useState([22])
  
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])

  useEffect(() => {
    setDisciplinas(getDisciplinas())
  }, [])

  function handleDisciplinaChange(index: number, field: keyof Disciplina, value: number) {
    const newDisciplinas = [...disciplinas]
    newDisciplinas[index] = { ...newDisciplinas[index], [field]: value } as Disciplina
    setDisciplinas(newDisciplinas)
  }

  function handleSaveDisciplinas() {
    saveDisciplinas(disciplinas)
    toast.success("Tabela de preços salva com sucesso.")
  }

  return (
    <Shell breadcrumb={["IEX", "Configurações"]}>
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Parâmetros gerais da plataforma e tabelas de preços.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
            <TabsTrigger value="precificacao">Precificação</TabsTrigger>
            <TabsTrigger value="rate-card">Tabela de Preços</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          </TabsList>

          {/* Empresa */}
          <TabsContent value="empresa" className="mt-5">
            <Card className="space-y-5 p-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Dados da empresa</h3>
                <p className="text-sm text-muted-foreground">
                  Informações exibidas nos documentos gerados.
                </p>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Razão social</Label>
                  <Input defaultValue="IEX Projetos Ltda." />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ</Label>
                  <Input defaultValue="45.546.897/0001-91" />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail comercial</Label>
                  <Input defaultValue="alderi@iexprojetos.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input defaultValue="(85) 99921-8630" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Endereço</Label>
                <Input defaultValue="Rua Monsenhor Bruno, 1153 – Salas 804/806 – Scopa Platinum Corporate" />
              </div>
              <div className="space-y-1.5">
                <Label>Texto de rodapé das propostas</Label>
                <Textarea
                  defaultValue="Proposta válida conforme condições comerciais."
                  rows={2}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => toast.success("Dados da empresa salvos.")}>Salvar alterações</Button>
              </div>
            </Card>
          </TabsContent>

          {/* Precificação */}
          <TabsContent value="precificacao" className="mt-5">
            <Card className="space-y-6 p-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Parâmetros de precificação</h3>
                <p className="text-sm text-muted-foreground">
                  Margens e limites aplicados às sugestões de preços.
                </p>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Margem-alvo padrão</Label>
                  <span className="text-sm font-medium tabular-nums text-foreground">{margem[0]}%</span>
                </div>
                <Slider value={margem} onValueChange={setMargem} min={5} max={45} step={1} />
                <p className="text-xs text-muted-foreground">
                  Margem aplicada por padrão sobre os custos estimados de projeto.
                </p>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Desconto máximo sem aprovação</Label>
                  <Input defaultValue="8%" />
                </div>
                <div className="space-y-1.5">
                  <Label>Validade padrão da proposta</Label>
                  <Input defaultValue="20 dias corridos" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Exigir justificativa em descontos</p>
                  <p className="text-xs text-muted-foreground">
                    Obriga registro de motivo quando o valor final ficar acima de 15% de desconto do sugerido.
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => toast.success("Parâmetros de precificação salvos.")}>
                  Salvar alterações
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Rate Card */}
          <TabsContent value="rate-card" className="mt-5">
            <Card className="space-y-6 p-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Tabela de Preços (Rate Card)</h3>
                <p className="text-sm text-muted-foreground">
                  Configure o valor base por m² e o valor mínimo cobrado por disciplina.
                </p>
              </div>
              <Separator />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Disciplina</th>
                      <th className="pb-2 text-right font-medium">Valor Base (R$/m²)</th>
                      <th className="pb-2 text-right font-medium">Valor Mínimo (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disciplinas.map((d, index) => (
                      <tr key={d.id} className="border-b border-border/60">
                        <td className="py-2 font-medium text-foreground">{d.nome}</td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={d.valorBaseM2}
                            onChange={(e) => handleDisciplinaChange(index, "valorBaseM2", Number(e.target.value))}
                            className="h-8 w-24 text-right tabular-nums ml-auto"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            step="100"
                            value={d.valorMinimo}
                            onChange={(e) => handleDisciplinaChange(index, "valorMinimo", Number(e.target.value))}
                            className="h-8 w-28 text-right tabular-nums ml-auto"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveDisciplinas}>
                  Salvar alterações
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Notificações */}
          <TabsContent value="notificacoes" className="mt-5">
            <Card className="space-y-2 p-6">
              <div className="mb-2">
                <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
                <p className="text-sm text-muted-foreground">
                  Defina quando deseja ser avisado sobre eventos comerciais.
                </p>
              </div>
              <Separator className="mb-2" />
              <ToggleRow title="Proposta sem retorno há mais de 7 dias" desc="Lembrete de follow-up automático." defaultChecked />
              <ToggleRow title="Proposta aprovada" desc="Aviso imediato ao mudar de status." defaultChecked />
              <ToggleRow title="Proposta perdida" desc="Notifica registro de motivo de perda." defaultChecked />
              <ToggleRow title="Resumo semanal por e-mail" desc="Panorama de desempenho toda segunda-feira." />
              <div className="flex justify-end pt-2">
                <Button onClick={() => toast.success("Preferências de notificação salvas.")}>
                  Salvar alterações
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  )
}

function ToggleRow({
  title,
  desc,
  checked,
  onCheckedChange,
  defaultChecked,
}: {
  title: string
  desc: string
  checked?: boolean
  onCheckedChange?: (v: boolean) => void
  defaultChecked?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {onCheckedChange ? (
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      ) : (
        <Switch defaultChecked={defaultChecked} />
      )}
    </div>
  )
}
