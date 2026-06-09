"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Check,
  FileText,
  Download,
  Pencil,
  TriangleAlert,
  Printer,
} from "lucide-react"
import { Shell } from "@/components/shell"
import { WizardStepper } from "@/components/wizard-stepper"
import { DocumentPreview, type DocumentData } from "@/components/document-preview"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"

import {
  clientes,
  tiposEmpreendimento,
  origensCliente,
  perfisCliente,
  formatBRL,
} from "@/lib/mock-data"
import type { Disciplina } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import {
  ComplexityFactors,
  defaultComplexity,
  calculateComplexityMultiplier,
  calculateSuggestedValue,
} from "@/lib/pricing"
import { getDraft, saveDraft, clearDraft, saveProposal, getDisciplinas } from "@/lib/storage"

const ENABLE_AI_FEATURES = false

const STEPS = [
  "Cliente",
  "Empreendimento",
  "Disciplinas",
  "Complexidade",
  "Precificação",
  "Ajustes e negociação",
  "Condições comerciais",
  "Revisão final",
  "Documento",
]

const complexidadeVars = [
  { key: "technicalComplexity", label: "Complexidade técnica", options: ["baixo", "medio", "alto"] },
  { key: "urgency", label: "Urgência", options: ["normal", "alta", "critica"] },
  { key: "materialQuality", label: "Qualidade do material recebido", options: ["boa", "media", "ruim"] },
  { key: "compatibilityLevel", label: "Nível de compatibilização", options: ["baixo", "medio", "alto"] },
  { key: "publicAgencyApproval", label: "Aprovação em órgão público", options: ["nao", "sim"] },
  { key: "expectedRevisions", label: "Revisões esperadas", options: ["baixa", "media", "alta"] },
  { key: "perceivedRisk", label: "Risco percebido", options: ["baixo", "medio", "alto"] },
  { key: "clientProfile", label: "Perfil do cliente", options: ["recorrente", "estrategico", "novo", "complexo"] },
]

export default function NovaPropostaPage() {
  const router = useRouter()
  const [isLoaded, setIsLoaded] = useState(false)
  const [step, setStep] = useState(0)

  // Cliente
  const [tipoCliente, setTipoCliente] = useState("existente")
  const [clienteSel, setClienteSel] = useState(clientes[0].id)
  const [razaoSocial, setRazaoSocial] = useState(clientes[0].razaoSocial)
  const [contato, setContato] = useState(clientes[0].contato)
  const [email, setEmail] = useState(clientes[0].email)
  const [telefone, setTelefone] = useState(clientes[0].telefone)
  const [origem, setOrigem] = useState(clientes[0].origem)
  const [perfil, setPerfil] = useState(clientes[0].perfil)

  // Empreendimento
  const [nomeObra, setNomeObra] = useState("Nova Unidade Boa Viagem")
  const [cidade, setCidade] = useState("Recife")
  const [uf, setUf] = useState("PE")
  const [tipoEmp, setTipoEmp] = useState("Clínica")
  const [area, setArea] = useState(1400)
  const [pavimentos, setPavimentos] = useState(3)
  const [padrao, setPadrao] = useState("Alto")
  const [fase, setFase] = useState("Executivo")

  // Disciplinas
  const [selDisc, setSelDisc] = useState<string[]>([])

  // Complexidade
  const [comp, setComp] = useState<ComplexityFactors>(defaultComplexity)

  // Pricing
  const [valoresFinais, setValoresFinais] = useState<Record<string, number>>({})
  const [justificativas, setJustificativas] = useState<Record<string, string>>({})

  // Condições comerciais
  const [formaPgto, setFormaPgto] = useState("40/40/20")
  const [prazoExec, setPrazoExec] = useState("30 dias úteis")
  const [validade, setValidade] = useState("20 dias corridos")
  
  const defaultPremissas = "Projeto executivo detalhado.\nMemorial técnico descritivo e especificações de materiais.\nPlanilha quantitativa de materiais.\nEntrega de arquivos editáveis em suporte digital, nas versões DWG, IFC e PDF, quando aplicável.\nFornecimento de ART junto ao CREA-CE.\nConsultoria para tramitação e aprovação dos projetos aplicáveis junto aos órgãos competentes."
  const defaultExclusoes = "Taxas de aprovação em órgãos fiscalizadores, quando houver, exceto quando indicado expressamente.\nProjetos não listados no escopo desta proposta.\nAlterações de escopo após aprovação formal da proposta.\nLevantamentos, laudos ou estudos complementares não descritos nesta proposta.\nProjetos de ETA, ETE, EEE ou rede adutora, salvo contratação específica."
  
  const [premissas, setPremissas] = useState(defaultPremissas)
  const [exclusoes, setExclusoes] = useState(defaultExclusoes)
  const [obsComerciais, setObsComerciais] = useState("")

  const [generatedDoc, setGeneratedDoc] = useState<DocumentData | null>(null)
  const [dynamicDisciplinas, setDynamicDisciplinas] = useState<Disciplina[]>([])

  useEffect(() => {
    setDynamicDisciplinas(getDisciplinas())
    const draft = getDraft()
    if (draft) {
      setStep(draft.step ?? 0)
      setTipoCliente(draft.tipoCliente ?? "existente")
      setClienteSel(draft.clienteSel ?? clientes[0].id)
      setRazaoSocial(draft.razaoSocial ?? clientes[0].razaoSocial)
      setContato(draft.contato ?? clientes[0].contato)
      setEmail(draft.email ?? clientes[0].email)
      setTelefone(draft.telefone ?? clientes[0].telefone)
      setOrigem(draft.origem ?? clientes[0].origem)
      setPerfil(draft.perfil ?? clientes[0].perfil)
      setNomeObra(draft.nomeObra ?? "Nova Unidade")
      setCidade(draft.cidade ?? "Recife")
      setUf(draft.uf ?? "PE")
      setTipoEmp(draft.tipoEmp ?? "Clínica")
      setArea(draft.area ?? 0)
      setPavimentos(draft.pavimentos ?? 0)
      setPadrao(draft.padrao ?? "Médio")
      setFase(draft.fase ?? "Executivo")
      setSelDisc(draft.selDisc ?? [])
      setComp(draft.comp ?? defaultComplexity)
      setValoresFinais(draft.valoresFinais ?? {})
      setJustificativas(draft.justificativas ?? {})
      setFormaPgto(draft.formaPgto ?? "40/40/20")
      setPrazoExec(draft.prazoExec ?? "30 dias úteis")
      setValidade(draft.validade ?? "20 dias corridos")
      setPremissas(draft.premissas ?? defaultPremissas)
      setExclusoes(draft.exclusoes ?? defaultExclusoes)
      setObsComerciais(draft.obsComerciais ?? "")
    } else {
      // Clear data if no draft
      setRazaoSocial("")
      setContato("")
      setEmail("")
      setTelefone("")
      setNomeObra("")
      setArea(0)
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (!isLoaded || step === 8) return // don't save draft after generating doc
    const draft = {
      step, tipoCliente, clienteSel, razaoSocial, contato, email, telefone, origem, perfil,
      nomeObra, cidade, uf, tipoEmp, area, pavimentos, padrao, fase,
      selDisc, comp, valoresFinais, justificativas,
      formaPgto, prazoExec, validade, premissas, exclusoes, obsComerciais
    }
    saveDraft(draft)
  }, [
    isLoaded, step, tipoCliente, clienteSel, razaoSocial, contato, email, telefone, origem, perfil,
    nomeObra, cidade, uf, tipoEmp, area, pavimentos, padrao, fase,
    selDisc, comp, valoresFinais, justificativas,
    formaPgto, prazoExec, validade, premissas, exclusoes, obsComerciais
  ])

  const complexMultiplier = useMemo(() => calculateComplexityMultiplier(comp), [comp])

  const itens = useMemo(() => {
    return selDisc.map((id) => {
      const d = dynamicDisciplinas.find((x) => x.id === id)
      if (!d) return { id, disciplina: "", sugerido: 0, final: 0, justificativa: "", escopo: [] }
      const sugerido = calculateSuggestedValue(area, d.valorBaseM2, d.valorMinimo, complexMultiplier)
      const final = valoresFinais[id] ?? sugerido
      return { id, disciplina: d.nome, sugerido, final, justificativa: justificativas[id] ?? "", escopo: d.escopoPadrao }
    })
  }, [selDisc, area, complexMultiplier, valoresFinais, justificativas, dynamicDisciplinas])

  const totalSugerido = itens.reduce((a, b) => a + b.sugerido, 0)
  const totalFinal = itens.reduce((a, b) => a + b.final, 0)

  // Dynamic conditions
  const parcelasCalc = useMemo(() => {
    if (formaPgto === "40/40/20") {
      return [
        { desc: "Sinal na aprovação (40%)", valor: totalFinal * 0.4 },
        { desc: "Entrega dos executivos (40%)", valor: totalFinal * 0.4 },
        { desc: "Aprovações (20%)", valor: totalFinal * 0.2 },
      ]
    }
    if (formaPgto === "50/50") {
      return [
        { desc: "Sinal na aprovação (50%)", valor: totalFinal * 0.5 },
        { desc: "Entrega dos executivos (50%)", valor: totalFinal * 0.5 },
      ]
    }
    return [
      { desc: "Conforme combinado (100%)", valor: totalFinal }
    ]
  }, [formaPgto, totalFinal])

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  function prev() {
    setStep((s) => Math.max(s - 1, 0))
  }
  function selectCliente(id: string) {
    setClienteSel(id)
    const c = clientes.find((x) => x.id === id)
    if (c) {
      setRazaoSocial(c.razaoSocial)
      setContato(c.contato)
      setEmail(c.email)
      setTelefone(c.telefone)
      setOrigem(c.origem)
      setPerfil(c.perfil)
    }
  }
  function toggleDisc(id: string) {
    setSelDisc((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  function handleGerarProposta() {
    if (!razaoSocial || !email || !nomeObra || area <= 0) {
      toast.error("Preencha os campos obrigatórios de cliente e obra (com área > 0).")
      return
    }

    const numero = `IEX-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(4, "0")}`
    
    const docData: DocumentData = {
      numero,
      cliente: razaoSocial,
      contato,
      empreendimento: nomeObra,
      cidade,
      uf,
      area,
      tipo: tipoEmp,
      itens: itens.map((i) => ({ disciplina: i.disciplina, valor: i.final, escopo: i.escopo })),
      total: totalFinal,
      formaPagamento: formaPgto,
      parcelas: parcelasCalc,
      prazoExecucao: prazoExec,
      validade,
      premissas: premissas.split("\n").filter(Boolean),
      exclusoes: exclusoes.split("\n").filter(Boolean),
      observacoes: obsComerciais,
      responsavel: "Antonio Alderi de Sousa Pereira",
    }

    setGeneratedDoc(docData)

    saveProposal({
      id: crypto.randomUUID(),
      numero,
      cliente: razaoSocial,
      clienteId: clienteSel,
      empreendimento: nomeObra,
      tipo: tipoEmp,
      cidade,
      uf,
      area,
      disciplinas: itens.map(i => i.disciplina),
      itens: itens.map(i => ({ disciplinaId: i.id, disciplina: i.disciplina, valorSugerido: i.sugerido, valorFinal: i.final, justificativa: i.justificativa })),
      valorSugerido: totalSugerido,
      valorFinal: totalFinal,
      status: "Em elaboração",
      responsavel: docData.responsavel,
      origem,
      dataCriacao: new Date().toISOString().split("T")[0],
      dataEnvio: null,
      ultimaAtualizacao: new Date().toISOString().split("T")[0],
      diasSemRetorno: 0,
      proximosPassos: "Proposta gerada. Aguardando envio." as any,
      historico: [{ data: new Date().toISOString().split("T")[0], usuario: docData.responsavel, acao: "Proposta gerada" }]
    })

    clearDraft()
    setStep(8) // Go to Document step
    toast.success("Proposta gerada e salva com sucesso!")
  }

  if (!isLoaded) return null

  return (
    <Shell breadcrumb={["IEX", "Propostas", "Nova proposta"]}>
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 no-print">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Nova proposta</h1>
            <p className="text-sm text-muted-foreground">
              Etapa {step + 1} de {STEPS.length} · {STEPS[step]}
            </p>
          </div>
          {step < 8 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.success("Rascunho salvo.")}>
                <Save className="h-4 w-4" /> Salvar rascunho
              </Button>
            </div>
          )}
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Card className="p-2">
              <WizardStepper steps={STEPS} current={step} onSelect={(idx) => {
                if (step < 8) setStep(idx)
              }} />
            </Card>
          </div>

          <div className="min-w-0 space-y-5">
            {step === 0 && (
              <Card className="space-y-5 p-6">
                <StepTitle title="Cliente" desc="Selecione um cliente existente ou cadastre um novo." />
                <RadioGroup value={tipoCliente} onValueChange={setTipoCliente} className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="existente" /> Cliente existente
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="novo" /> Novo cliente
                  </label>
                </RadioGroup>
                {tipoCliente === "existente" && (
                  <div className="space-y-1.5">
                    <Label>Cliente</Label>
                    <Select value={clienteSel} onValueChange={selectCliente}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldInput label="Razão social *" value={razaoSocial} onChange={setRazaoSocial} />
                  <FieldInput label="Contato principal *" value={contato} onChange={setContato} />
                  <FieldInput label="E-mail *" value={email} onChange={setEmail} />
                  <FieldInput label="Telefone" value={telefone} onChange={setTelefone} />
                  <FieldSelect label="Origem do cliente" value={origem} onChange={setOrigem} options={origensCliente} />
                  <FieldSelect label="Perfil do cliente" value={perfil} onChange={setPerfil} options={perfisCliente} />
                </div>
              </Card>
            )}

            {step === 1 && (
              <Card className="space-y-5 p-6">
                <StepTitle title="Empreendimento" desc="Dados da obra que orientam a precificação." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldInput label="Nome da obra *" value={nomeObra} onChange={setNomeObra} />
                  <FieldSelect label="Tipo de empreendimento *" value={tipoEmp} onChange={setTipoEmp} options={tiposEmpreendimento} />
                  <FieldInput label="Cidade" value={cidade} onChange={setCidade} />
                  <FieldInput label="UF" value={uf} onChange={setUf} />
                  <div className="space-y-1.5">
                    <Label>Área (m²) *</Label>
                    <Input type="number" value={area} onChange={(e) => setArea(Number(e.target.value) || 0)} min={1} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pavimentos</Label>
                    <Input type="number" value={pavimentos} onChange={(e) => setPavimentos(Number(e.target.value) || 0)} />
                  </div>
                  <FieldSelect label="Padrão construtivo" value={padrao} onChange={setPadrao} options={["Econômico", "Médio", "Alto", "Luxo"]} />
                  <FieldSelect label="Fase do projeto" value={fase} onChange={setFase} options={["Estudo preliminar", "Anteprojeto", "Executivo", "As built"]} />
                </div>
              </Card>
            )}

            {step === 2 && (
              <Card className="space-y-5 p-6">
                <StepTitle title="Disciplinas" desc="Selecione as disciplinas que compõem o escopo." />
                <div className="grid gap-3 sm:grid-cols-2">
                  {dynamicDisciplinas.map((d) => {
                    const active = selDisc.includes(d.id)
                    return (
                      <button
                        key={d.id}
                        onClick={() => toggleDisc(d.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                          active ? "border-primary bg-secondary/60" : "border-border hover:border-primary/40 hover:bg-secondary/30",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                            active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                          )}
                        >
                          {active && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="flex-1 space-y-0.5">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{d.nome}</span>
                            <span className="text-xs text-muted-foreground">{d.valorBaseM2 > 0 ? `${formatBRL(d.valorBaseM2)}/m²` : "Fixo"}</span>
                          </span>
                          <span className="block text-xs text-muted-foreground">{d.descricao}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Card>
            )}

            {step === 3 && (
              <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                <Card className="space-y-6 p-6">
                  <StepTitle title="Complexidade" desc="Avalie as variáveis do projeto para ajuste de rate card." />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {complexidadeVars.map((v) => (
                      <div key={v.key} className="space-y-1.5">
                        <Label className="text-sm">{v.label}</Label>
                        <Select value={(comp as any)[v.key]} onValueChange={(val) => setComp((c) => ({ ...c, [v.key]: val }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {v.options.map((o) => <SelectItem key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="h-fit space-y-4 p-5 lg:sticky lg:top-4">
                  <h4 className="text-sm font-semibold text-foreground">Resumo de cálculo</h4>
                  <div className="rounded-md bg-secondary p-4 text-center">
                    <p className="text-xs text-muted-foreground">Impacto percentual total</p>
                    <p className="text-2xl font-semibold text-foreground">
                      {complexMultiplier >= 1 ? "+" : ""}
                      {((complexMultiplier - 1) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    O fator ajusta o valor sugerido. Multiplicador final: {complexMultiplier.toFixed(2)}x
                  </p>
                </Card>
              </div>
            )}

            {step === 4 && (
              <Card className="space-y-5 p-6">
                <StepTitle title="Precificação" desc="Valores calculados com base em área, rate card e complexidade." />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Disciplina</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right font-bold text-foreground">Sugerido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((i) => {
                      const d = dynamicDisciplinas.find(x => x.id === i.id)!;
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">{i.disciplina}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatBRL(d.valorBaseM2)}/m²</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatBRL(d.valorMinimo)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-foreground">{formatBRL(i.sugerido)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between rounded-md bg-secondary px-4 py-3">
                  <span className="text-sm text-muted-foreground">Total sugerido da proposta</span>
                  <span className="text-lg font-semibold tabular-nums text-primary">{formatBRL(totalSugerido)}</span>
                </div>
                <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 p-3">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Os valores sugeridos são calculados com base na área informada, no valor base por m² de cada disciplina, nos valores mínimos e nos fatores de complexidade selecionados.
                  </p>
                </div>
              </Card>
            )}

            {step === 5 && (
              <Card className="space-y-5 p-6">
                <StepTitle title="Ajustes e negociação" desc="Edite os valores finais e registre justificativas se necessário." />
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Disciplina</TableHead>
                        <TableHead className="text-right">Sugerido</TableHead>
                        <TableHead className="text-right">Valor final</TableHead>
                        <TableHead className="text-right">Variação</TableHead>
                        <TableHead>Justificativa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((i) => {
                        const variacao = i.sugerido ? ((i.final - i.sugerido) / i.sugerido) * 100 : 0
                        const alerta = Math.abs(variacao) > 15
                        return (
                          <TableRow key={i.id}>
                            <TableCell className="font-medium">{i.disciplina}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{formatBRL(i.sugerido)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={i.final}
                                onChange={(e) => setValoresFinais((v) => ({ ...v, [i.id]: Number(e.target.value) || 0 }))}
                                className={cn("h-8 w-28 text-right tabular-nums", alerta && "border-warning text-warning")}
                              />
                            </TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums",
                              variacao > 0 ? "text-[oklch(0.45_0.1_155)]" : variacao < 0 ? "text-danger" : "text-muted-foreground",
                            )}>
                              {variacao >= 0 ? "+" : ""}{variacao.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              <Input
                                value={i.justificativa}
                                placeholder={alerta ? "Justificativa recomendada..." : "—"}
                                onChange={(e) => setJustificativas((j) => ({ ...j, [i.id]: e.target.value }))}
                                className={cn("h-8 min-w-44", alerta && !i.justificativa && "border-warning")}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/20 p-3">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Registrar o motivo da alteração ajuda a manter a rastreabilidade comercial.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-md bg-secondary px-4 py-3">
                  <span className="text-sm text-muted-foreground">Total finalizado</span>
                  <span className="text-lg font-semibold tabular-nums">{formatBRL(totalFinal)}</span>
                </div>
              </Card>
            )}

            {step === 6 && (
              <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                <Card className="space-y-5 p-6">
                  <StepTitle title="Condições comerciais" desc="Defina pagamento, prazos e termos da proposta." />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldSelect label="Forma de pagamento" value={formaPgto} onChange={setFormaPgto} options={["40/40/20", "50/50", "Personalizado"]} />
                    <FieldInput label="Prazo de execução" value={prazoExec} onChange={setPrazoExec} />
                    <FieldInput label="Validade da proposta" value={validade} onChange={setValidade} />
                  </div>
                  <FieldTextareaControlled label="Premissas" value={premissas} onChange={setPremissas} />
                  <FieldTextareaControlled label="Exclusões" value={exclusoes} onChange={setExclusoes} />
                  <FieldTextareaControlled label="Observações comerciais" value={obsComerciais} onChange={setObsComerciais} />
                </Card>
                <Card className="h-fit space-y-3 p-5 lg:sticky lg:top-4">
                  <h4 className="text-sm font-semibold text-foreground">Resumo financeiro</h4>
                  <div className="space-y-2 text-sm">
                    <Row label="Total" value={formatBRL(totalFinal)} bold />
                    <Separator />
                    {parcelasCalc.map((p, i) => (
                      <Row key={i} label={p.desc} value={formatBRL(p.valor)} muted />
                    ))}
                    <Separator />
                    <Row label="Prazo" value={prazoExec} muted />
                    <Row label="Validade" value={validade} muted />
                  </div>
                </Card>
              </div>
            )}

            {step === 7 && (
              <Card className="space-y-6 p-6">
                <StepTitle title="Revisão final" desc="Confira todos os dados antes de gerar o documento." />
                <ReviewSection title="Cliente">
                  <Row label="Razão social" value={razaoSocial} />
                  <Row label="Contato / E-mail" value={`${contato} · ${email}`} />
                </ReviewSection>
                <ReviewSection title="Empreendimento">
                  <Row label="Obra" value={nomeObra} />
                  <Row label="Tipo · área" value={`${tipoEmp} · ${area.toLocaleString("pt-BR")} m²`} />
                </ReviewSection>
                <ReviewSection title="Valores por disciplina">
                  {itens.map((i) => (
                    <Row key={i.id} label={i.disciplina} value={formatBRL(i.final)} />
                  ))}
                  <Separator />
                  <Row label="Total final" value={formatBRL(totalFinal)} bold />
                </ReviewSection>
                <ReviewSection title="Condições comerciais">
                  <Row label="Pagamento" value={formaPgto} />
                  <Row label="Prazo · validade" value={`${prazoExec} · ${validade}`} />
                </ReviewSection>
                <div className="flex justify-end gap-3 mt-4">
                  <Button variant="outline" onClick={() => setStep(0)}>Revisar dados</Button>
                  <Button onClick={handleGerarProposta}>
                    <FileText className="h-4 w-4" /> Gerar proposta
                  </Button>
                </div>
              </Card>
            )}

            {/* Navigation (Only show if not on Document step) */}
            {step < 8 && (
              <div className="flex items-center justify-between mt-6">
                <Button variant="outline" onClick={prev} disabled={step === 0}>
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                {step !== 7 && (
                  <Button onClick={next}>
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {step === 8 && generatedDoc && (
        <div className="print-only-container">
          <div className="no-print mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
            <Button variant="outline" onClick={() => router.push("/propostas")}>
              <ArrowLeft className="h-4 w-4" /> Voltar para lista
            </Button>
            <div className="flex gap-2">
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </Button>
            </div>
          </div>
          <div className="mx-auto max-w-5xl p-4 sm:p-8">
            <DocumentPreview data={generatedDoc} />
          </div>
        </div>
      )}
    </Shell>
  )
}

function StepTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  )
}

function FieldInput({ label, value, onChange, min }: { label: string; value: string; onChange: (v: string) => void; min?: number }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function FieldTextareaControlled({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
    </div>
  )
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm tabular-nums", bold ? "font-semibold text-foreground" : muted ? "text-muted-foreground" : "text-foreground")}>
        {value}
      </span>
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-2 rounded-md border border-border bg-card p-4">{children}</div>
    </div>
  )
}
