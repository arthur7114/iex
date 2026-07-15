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
  TriangleAlert,
  Printer,
  Plus,
  Trash2,
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

import { Switch } from "@/components/ui/switch"
import { formatBRL } from "@/lib/mock-data"
import type { Cliente, Disciplina, VariavelComplexidade, Obra } from "@/lib/db/types"
import { cn } from "@/lib/utils"
import { getDraft, saveDraft, clearDraft } from "@/lib/storage"
import { listarDisciplinas } from "@/lib/db/disciplinas"
import { listarClientesComMetricas, criarCliente } from "@/lib/db/clientes"
import { listarObrasPorCliente, getObra, criarObra, atualizarObra } from "@/lib/db/obras"
import { listarOpcoes } from "@/lib/db/lookups"
import { listarVariaveis, calcularMultiplicador, calcularValorSugerido } from "@/lib/db/complexidade"
import { criarProposta, atualizarProposta, getProposta, getPropostaEdicao } from "@/lib/db/propostas"
import { getUsuarioAtual } from "@/lib/db/usuarios"
import { registrarAjustes } from "@/lib/db/ajustes"
import { snapshotVersao } from "@/lib/db/versoes"
import { getModeloPadrao } from "@/lib/db/modelos"
import { EmailComposer, type ResultadoEnvio } from "@/components/email-composer"
import { gerarPdf } from "@/lib/document/pdf"
import { gerarWord } from "@/lib/document/word"
import type { PropostaDoc, EmpresaDoc } from "@/lib/document/tipos"
import { montarDocumento } from "@/lib/document/montar"
import { baixarBlob, blobParaBase64 } from "@/lib/document/util"
import { enviarProposta } from "@/lib/actions/email"
import { transicionarStatus } from "@/lib/db/propostas"

const STEPS = [
  "Cliente",
  "Obra",
  "Disciplinas",
  "Complexidade",
  "Precificação",
  "Ajustes e negociação",
  "Condições comerciais",
  "Revisão final",
  "Documento",
]

const URGENCIAS = ["Baixa", "Normal", "Alta", "Crítica"]
const REPETITIVIDADES = ["Não se aplica", "Baixa", "Média", "Alta"]

interface ParcelaEdit {
  descricao: string
  percentual: number
  marco: boolean
}

// Sugere uma estrutura inicial de parcelas a partir do nome da forma de pagamento.
function parcelasPadrao(forma: string): ParcelaEdit[] {
  const f = (forma || "").toLowerCase()
  const nums = (forma.match(/\d+/g) ?? []).map(Number)
  const rotulos = ["Sinal na aprovação", "Entrega dos executivos", "Aprovações finais", "Parcela"]
  if (nums.length >= 2) {
    const soma = nums.reduce((a, b) => a + b, 0)
    if (soma === 100) {
      return nums.map((n, i) => ({ descricao: rotulos[i] ?? `Parcela ${i + 1}`, percentual: n, marco: false }))
    }
    // Sequência de prazos (ex.: 30/60/90 dias) — divide igualmente.
    const n = nums.length
    const base = Math.floor(100 / n)
    return nums.map((d, i) => ({
      descricao: `Parcela ${i + 1} (${d} dias)`,
      percentual: i === n - 1 ? 100 - base * (n - 1) : base,
      marco: false,
    }))
  }
  if (f.includes("vista")) return [{ descricao: "Pagamento à vista", percentual: 100, marco: false }]
  if (f.includes("marco")) {
    return [
      { descricao: "Sinal na aprovação", percentual: 30, marco: false },
      { descricao: "Marco intermediário do projeto", percentual: 40, marco: true },
      { descricao: "Entrega final dos projetos", percentual: 30, marco: true },
    ]
  }
  if (f.includes("entrada")) {
    return [
      { descricao: "Entrada", percentual: 40, marco: false },
      { descricao: "Saldo na entrega", percentual: 60, marco: false },
    ]
  }
  if (f.includes("mensal")) {
    return [
      { descricao: "1ª mensalidade", percentual: 34, marco: false },
      { descricao: "2ª mensalidade", percentual: 33, marco: false },
      { descricao: "3ª mensalidade", percentual: 33, marco: false },
    ]
  }
  return [
    { descricao: "Sinal na aprovação", percentual: 40, marco: false },
    { descricao: "Entrega dos executivos", percentual: 40, marco: false },
    { descricao: "Aprovações finais", percentual: 20, marco: false },
  ]
}

export default function NovaPropostaPage() {
  const router = useRouter()
  const [isLoaded, setIsLoaded] = useState(false)
  const [step, setStep] = useState(0)

  // Dados carregados do banco
  const [clientesList, setClientesList] = useState<Cliente[]>([])
  const [origensCliente, setOrigensCliente] = useState<string[]>([])
  const [perfisCliente, setPerfisCliente] = useState<string[]>([])
  const [tiposEmpreendimento, setTiposEmpreendimento] = useState<string[]>([])
  const [formasPagamento, setFormasPagamento] = useState<string[]>([])
  const [variaveis, setVariaveis] = useState<VariavelComplexidade[]>([])
  const [responsavel, setResponsavel] = useState({ id: null as string | null, nome: "" })
  // Documento montado a partir da proposta salva (fonte única — mesma do drawer).
  const [docBundle, setDocBundle] = useState<{ doc: PropostaDoc; empresa: EmpresaDoc } | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [propostaId, setPropostaId] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)

  // Cliente
  const [tipoCliente, setTipoCliente] = useState("existente")
  const [clienteSel, setClienteSel] = useState("")
  const [razaoSocial, setRazaoSocial] = useState("")
  const [contato, setContato] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [origem, setOrigem] = useState("")
  const [perfil, setPerfil] = useState("")

  // Obra (empreendimento) — pertence ao cliente
  const [obrasDoCliente, setObrasDoCliente] = useState<Obra[]>([])
  const [obraMode, setObraMode] = useState<"existente" | "nova">("nova")
  const [obraSel, setObraSel] = useState("")
  const [nomeObra, setNomeObra] = useState("")
  const [cidade, setCidade] = useState("")
  const [uf, setUf] = useState("")
  const [tipoEmp, setTipoEmp] = useState("")
  const [area, setArea] = useState(0)
  const [pavimentos, setPavimentos] = useState(0)
  const [padrao, setPadrao] = useState("Médio")
  const [fase, setFase] = useState("Executivo")
  const [urgencia, setUrgencia] = useState("Normal")
  const [repetitividade, setRepetitividade] = useState("Não se aplica")

  // Disciplinas
  const [selDisc, setSelDisc] = useState<string[]>([])
  // Escopo editável por disciplina (texto, uma linha por item). undefined = usa o padrão.
  const [escoposTexto, setEscoposTexto] = useState<Record<string, string>>({})

  // Complexidade (chave -> opcao). Vazio = sem impacto (multiplicador 1.0).
  const [comp, setComp] = useState<Record<string, string>>({})
  const [pularComplexidade, setPularComplexidade] = useState(false)

  // Pricing
  const [valoresFinais, setValoresFinais] = useState<Record<string, number>>({})
  const [justificativas, setJustificativas] = useState<Record<string, string>>({})

  // Condições comerciais
  const [formaPgto, setFormaPgto] = useState("Entrada + parcelas")
  const [parcelas, setParcelas] = useState<ParcelaEdit[]>(() => parcelasPadrao("Entrada + parcelas"))
  const [prazoExec, setPrazoExec] = useState("30 dias úteis")
  const [validade, setValidade] = useState("20 dias corridos")

  const defaultPremissas = "Projeto executivo detalhado.\nMemorial técnico descritivo e especificações de materiais.\nPlanilha quantitativa de materiais.\nEntrega de arquivos editáveis em suporte digital, nas versões DWG, IFC e PDF, quando aplicável.\nFornecimento de ART junto ao CREA-CE.\nConsultoria para tramitação e aprovação dos projetos aplicáveis junto aos órgãos competentes."
  const defaultExclusoes = "Taxas de aprovação em órgãos fiscalizadores, quando houver, exceto quando indicado expressamente.\nProjetos não listados no escopo desta proposta.\nAlterações de escopo após aprovação formal da proposta.\nLevantamentos, laudos ou estudos complementares não descritos nesta proposta.\nProjetos de ETA, ETE, EEE ou rede adutora, salvo contratação específica."

  const [premissas, setPremissas] = useState(defaultPremissas)
  const [exclusoes, setExclusoes] = useState(defaultExclusoes)
  const [obsComerciais, setObsComerciais] = useState("")

  const [generatedDoc, setGeneratedDoc] = useState<DocumentData | null>(null)
  const [dynamicDisciplinas, setDynamicDisciplinas] = useState<Disciplina[]>([])

  // Carrega as obras de um cliente e devolve a lista.
  async function carregarObras(clienteId: string): Promise<Obra[]> {
    if (!clienteId) {
      setObrasDoCliente([])
      return []
    }
    try {
      const obras = await listarObrasPorCliente(clienteId)
      setObrasDoCliente(obras)
      return obras
    } catch {
      setObrasDoCliente([])
      return []
    }
  }

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
        const idEdicao = params?.get("id") ?? null
        const clienteParam = params?.get("cliente") ?? null
        const obraParam = params?.get("obra") ?? null
        const [disc, cls, origens, perfis, tipos, formas, vars, usuario, modelo] = await Promise.all([
          listarDisciplinas(),
          listarClientesComMetricas(),
          listarOpcoes("origem_cliente"),
          listarOpcoes("perfil_cliente"),
          listarOpcoes("tipo_empreendimento"),
          listarOpcoes("forma_pagamento"),
          listarVariaveis(),
          getUsuarioAtual(),
          getModeloPadrao().catch(() => null),
        ])
        if (!ativo) return
        setDynamicDisciplinas(disc)
        setClientesList(cls)
        setOrigensCliente(origens.map((o) => o.nome))
        setPerfisCliente(perfis.map((p) => p.nome))
        setTiposEmpreendimento(tipos.map((t) => t.nome))
        setFormasPagamento(formas.map((f) => f.nome))
        setVariaveis(vars)
        if (usuario) setResponsavel({ id: usuario.id, nome: usuario.nome })

        // Modo edição: reabre uma proposta existente
        if (idEdicao) {
          const p = await getPropostaEdicao(idEdicao)
          if (p && ativo) {
            setEditId(idEdicao)
            setPropostaId(idEdicao)
            setTipoCliente(p.clienteId ? "existente" : "novo")
            setClienteSel(p.clienteId ?? "")
            setRazaoSocial(p.clienteNome)
            // Dados de contato moram no cadastro do cliente (não na proposta).
            const cEdit = p.clienteId ? cls.find((x) => x.id === p.clienteId) : null
            if (cEdit) {
              setContato(cEdit.contato)
              setEmail(cEdit.email)
              setTelefone(cEdit.telefone)
              setPerfil(cEdit.perfil)
            }
            // Snapshot do empreendimento como base (pode ser sobrescrito pela obra).
            setNomeObra(p.empreendimento)
            setTipoEmp(p.tipo)
            setCidade(p.cidade)
            setUf(p.uf)
            setArea(p.area)
            setPavimentos(p.pavimentos)
            setPadrao(p.padrao)
            setFase(p.fase)
            if (p.clienteId) {
              const obras = await carregarObras(p.clienteId)
              // Preserva o vínculo mesmo se a obra estiver arquivada (busca direta).
              const obraAtual = obras.find((o) => o.id === p.obraId) ?? (p.obraId ? await getObra(p.obraId) : null)
              if (p.obraId && obraAtual) {
                setObraMode("existente")
                aplicarObra(obraAtual) // usa o cadastro atual da obra como fonte
              } else {
                setObraMode("nova")
              }
            }
            setSelDisc(p.itens.map((i) => i.disciplinaId).filter(Boolean))
            setValoresFinais(Object.fromEntries(p.itens.map((i) => [i.disciplinaId, i.valorFinal])))
            setJustificativas(Object.fromEntries(p.itens.map((i) => [i.disciplinaId, i.justificativa])))
            // Popula o escopo de TODOS os itens (inclusive vazio) para não ressuscitar o padrão.
            setEscoposTexto(Object.fromEntries(p.itens.map((i) => [i.disciplinaId, (i.escopo ?? []).join("\n")])))
            setComp(p.complexidade ?? {})
            setPularComplexidade(!p.complexidade)
            setOrigem(p.origem)
            setFormaPgto(p.formaPagamento)
            setParcelas(
              p.parcelas && p.parcelas.length
                ? p.parcelas.map((pp) => ({ descricao: pp.descricao, percentual: pp.percentual, marco: !!pp.marco }))
                : parcelasPadrao(p.formaPagamento),
            )
            setPrazoExec(p.prazoExecucao)
            setValidade(p.validade)
            setPremissas(p.premissas || defaultPremissas)
            setExclusoes(p.exclusoes || defaultExclusoes)
            setObsComerciais(p.observacoes)
            setStep(7) // vai direto à revisão final
          }
          setIsLoaded(true)
          return
        }

        // Aplica o modelo padrão (PRD 008) — usado em proposta nova.
        const aplicarModelo = () => {
          if (!modelo) return
          if (modelo.premissas) setPremissas(modelo.premissas)
          if (modelo.exclusoes) setExclusoes(modelo.exclusoes)
          if (modelo.formaPagamentoPadrao) {
            setFormaPgto(modelo.formaPagamentoPadrao)
            setParcelas(parcelasPadrao(modelo.formaPagamentoPadrao))
          }
          if (modelo.prazoExecucaoPadrao) setPrazoExec(modelo.prazoExecucaoPadrao)
          if (modelo.validadePadrao) setValidade(modelo.validadePadrao)
        }

        // Abertura a partir de um cliente (?cliente=) inicia uma proposta nova para
        // ele, com prioridade sobre qualquer rascunho anterior.
        if (clienteParam) {
          clearDraft()
          aplicarModelo()
          const c = cls.find((x) => x.id === clienteParam)
          if (c) {
            setTipoCliente("existente")
            setClienteSel(c.id)
            setRazaoSocial(c.razaoSocial)
            setContato(c.contato)
            setEmail(c.email)
            setTelefone(c.telefone)
            setOrigem(c.origem)
            setPerfil(c.perfil)
            const obras = await carregarObras(c.id)
            const obraPre = obraParam ? obras.find((o) => o.id === obraParam) : null
            if (obraPre) {
              setObraMode("existente")
              aplicarObra(obraPre)
            } else {
              setObraMode(obras.length ? "existente" : "nova")
            }
          }
          setIsLoaded(true)
          return
        }

        const draft = getDraft()
        if (draft) {
          setStep(draft.step ?? 0)
          setTipoCliente(draft.tipoCliente ?? "existente")
          setClienteSel(draft.clienteSel ?? "")
          setRazaoSocial(draft.razaoSocial ?? "")
          setContato(draft.contato ?? "")
          setEmail(draft.email ?? "")
          setTelefone(draft.telefone ?? "")
          setOrigem(draft.origem ?? "")
          setPerfil(draft.perfil ?? "")
          setObraMode(draft.obraMode ?? "nova")
          setObraSel(draft.obraSel ?? "")
          setNomeObra(draft.nomeObra ?? "")
          setCidade(draft.cidade ?? "")
          setUf(draft.uf ?? "")
          setTipoEmp(draft.tipoEmp ?? "")
          setArea(draft.area ?? 0)
          setPavimentos(draft.pavimentos ?? 0)
          setPadrao(draft.padrao ?? "Médio")
          setFase(draft.fase ?? "Executivo")
          setUrgencia(draft.urgencia ?? "Normal")
          setRepetitividade(draft.repetitividade ?? "Não se aplica")
          setSelDisc(draft.selDisc ?? [])
          setEscoposTexto(draft.escoposTexto ?? {})
          setComp(draft.comp ?? {})
          setPularComplexidade(draft.pularComplexidade ?? false)
          setValoresFinais(draft.valoresFinais ?? {})
          setJustificativas(draft.justificativas ?? {})
          setFormaPgto(draft.formaPgto ?? "Entrada + parcelas")
          setParcelas(draft.parcelas ?? parcelasPadrao(draft.formaPgto ?? "Entrada + parcelas"))
          setPrazoExec(draft.prazoExec ?? "30 dias úteis")
          setValidade(draft.validade ?? "20 dias corridos")
          setPremissas(draft.premissas ?? defaultPremissas)
          setExclusoes(draft.exclusoes ?? defaultExclusoes)
          setObsComerciais(draft.obsComerciais ?? "")
          if (draft.clienteSel) carregarObras(draft.clienteSel)
        } else {
          aplicarModelo()
        }
      } catch (e) {
        console.error(e)
        toast.error("Falha ao carregar dados. Verifique sua conexão.")
      } finally {
        if (ativo) setIsLoaded(true)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    // Não salva rascunho após gerar (8) nem em modo edição (não deve contaminar proposta nova).
    if (!isLoaded || step === 8 || editId) return
    const draft = {
      step, tipoCliente, clienteSel, razaoSocial, contato, email, telefone, origem, perfil,
      obraMode, obraSel, nomeObra, cidade, uf, tipoEmp, area, pavimentos, padrao, fase, urgencia, repetitividade,
      selDisc, escoposTexto, comp, pularComplexidade, valoresFinais, justificativas,
      formaPgto, parcelas, prazoExec, validade, premissas, exclusoes, obsComerciais,
    }
    saveDraft(draft)
  }, [
    isLoaded, editId, step, tipoCliente, clienteSel, razaoSocial, contato, email, telefone, origem, perfil,
    obraMode, obraSel, nomeObra, cidade, uf, tipoEmp, area, pavimentos, padrao, fase, urgencia, repetitividade,
    selDisc, escoposTexto, comp, pularComplexidade, valoresFinais, justificativas,
    formaPgto, parcelas, prazoExec, validade, premissas, exclusoes, obsComerciais,
  ])

  const complexMultiplier = useMemo(
    () => (pularComplexidade ? 1 : calcularMultiplicador(variaveis, comp)),
    [variaveis, comp, pularComplexidade],
  )

  const itens = useMemo(() => {
    return selDisc.map((id) => {
      const d = dynamicDisciplinas.find((x) => x.id === id)
      if (!d) return { id, disciplina: "", sugerido: 0, final: 0, justificativa: "", escopo: [] as string[] }
      const sugerido = calcularValorSugerido(area, d.valorBaseM2, d.valorMinimo, complexMultiplier)
      const final = valoresFinais[id] ?? sugerido
      const escopo =
        escoposTexto[id] !== undefined ? escoposTexto[id].split("\n").map((s) => s.trim()).filter(Boolean) : d.escopoPadrao
      return { id, disciplina: d.nome, sugerido, final, justificativa: justificativas[id] ?? "", escopo }
    })
  }, [selDisc, area, complexMultiplier, valoresFinais, justificativas, escoposTexto, dynamicDisciplinas])

  const totalSugerido = itens.reduce((a, b) => a + b.sugerido, 0)
  const totalFinal = itens.reduce((a, b) => a + b.final, 0)

  const somaPercentual = parcelas.reduce((a, p) => a + (Number(p.percentual) || 0), 0)

  // Parcelas para o documento (descrição enriquecida + valor calculado).
  const parcelasDoc = useMemo(
    () =>
      parcelas.map((p) => ({
        desc: p.marco
          ? `${p.descricao} (marco — ${p.percentual}%)`
          : `${p.descricao} (${p.percentual}%)`,
        valor: Math.round((totalFinal * (Number(p.percentual) || 0)) / 100),
      })),
    [parcelas, totalFinal],
  )

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  function prev() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function selectCliente(id: string) {
    setClienteSel(id)
    const c = clientesList.find((x) => x.id === id)
    if (c) {
      setRazaoSocial(c.razaoSocial)
      setContato(c.contato)
      setEmail(c.email)
      setTelefone(c.telefone)
      setOrigem(c.origem)
      setPerfil(c.perfil)
    }
    // Troca de cliente: limpa a obra anterior para não contaminar entre clientes.
    setObraSel("")
    setNomeObra("")
    setTipoEmp("")
    setCidade("")
    setUf("")
    setArea(0)
    setPavimentos(0)
    setPadrao("Médio")
    setFase("Executivo")
    setUrgencia("Normal")
    setRepetitividade("Não se aplica")
    const obras = await carregarObras(id)
    setObraMode(obras.length ? "existente" : "nova")
  }

  // Preenche os campos da obra a partir de uma obra existente.
  function aplicarObra(o: Obra) {
    setObraSel(o.id)
    setNomeObra(o.nome)
    setTipoEmp(o.tipo)
    setCidade(o.cidade)
    setUf(o.uf)
    setArea(o.area)
    setPavimentos(o.pavimentos ?? 0)
    setPadrao(o.padrao || "Médio")
    setFase(o.fase || "Executivo")
    setUrgencia(o.urgencia || "Normal")
    setRepetitividade(o.repetitividade || "Não se aplica")
  }

  function selectObra(id: string) {
    const o = obrasDoCliente.find((x) => x.id === id)
    if (o) aplicarObra(o)
  }

  function toggleDisc(id: string) {
    setSelDisc((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  function setParcela(idx: number, patch: Partial<ParcelaEdit>) {
    setParcelas((cur) => cur.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }
  function addParcela() {
    setParcelas((cur) => [...cur, { descricao: "Nova parcela", percentual: 0, marco: false }])
  }
  function removeParcela(idx: number) {
    setParcelas((cur) => cur.filter((_, i) => i !== idx))
  }
  function redefinirParcelas() {
    setParcelas(parcelasPadrao(formaPgto))
  }

  const [salvando, setSalvando] = useState(false)

  async function handleGerarProposta() {
    const clienteOk = tipoCliente === "existente" ? !!clienteSel : !!razaoSocial && !!email
    if (!clienteOk) {
      toast.error("Selecione um cliente existente ou informe razão social e e-mail.")
      setStep(0)
      return
    }
    if (!nomeObra || area <= 0) {
      toast.error("Informe o nome da obra e uma área maior que zero.")
      setStep(1)
      return
    }
    if (!selDisc.length) {
      toast.error("Selecione ao menos uma disciplina.")
      setStep(2)
      return
    }
    if (somaPercentual !== 100) {
      toast.error("A soma das parcelas precisa ser 100%. Ajuste a estrutura de pagamento.")
      setStep(6)
      return
    }
    setSalvando(true)
    const responsavelNome = responsavel.nome || "—"
    try {
      // 1) Garante o cliente (persiste novo cliente, se for o caso).
      let clienteId: string | null = tipoCliente === "existente" && clienteSel ? clienteSel : null
      if (tipoCliente === "novo") {
        clienteId = await criarCliente({ razaoSocial, contato, email, telefone, origem, perfil })
        setTipoCliente("existente")
        setClienteSel(clienteId)
      }

      // 2) Garante a obra (cria nova ou atualiza a existente) — orçamento é da obra.
      const obraFields = {
        clienteId: clienteId as string,
        nome: nomeObra,
        tipo: tipoEmp,
        cidade,
        uf,
        area,
        pavimentos,
        padrao,
        fase,
        urgencia,
        repetitividade,
      }
      let obraIdResolved: string | null = null
      if (clienteId) {
        if (obraMode === "existente" && obraSel) {
          obraIdResolved = obraSel
          await atualizarObra(obraSel, obraFields)
        } else {
          obraIdResolved = await criarObra(obraFields)
          setObraMode("existente")
          setObraSel(obraIdResolved)
        }
      }

      // 3) Parcelas estruturadas com valor calculado.
      const parcelasInput = parcelas.map((p) => ({
        descricao: p.descricao,
        percentual: Number(p.percentual) || 0,
        valor: Math.round((totalFinal * (Number(p.percentual) || 0)) / 100),
        marco: p.marco,
      }))

      const input = {
        clienteId,
        obraId: obraIdResolved,
        clienteNome: razaoSocial,
        empreendimento: nomeObra,
        tipo: tipoEmp,
        cidade,
        uf,
        area,
        pavimentos,
        padrao,
        fase,
        disciplinas: itens.map((i) => i.disciplina),
        complexidade: pularComplexidade ? null : comp,
        itens: itens.map((i) => ({
          disciplinaId: i.id,
          disciplina: i.disciplina,
          valorSugerido: i.sugerido,
          valorFinal: i.final,
          justificativa: i.justificativa,
          escopo: i.escopo,
        })),
        valorSugerido: totalSugerido,
        valorFinal: totalFinal,
        origem,
        formaPagamento: formaPgto,
        parcelas: parcelasInput,
        prazoExecucao: prazoExec,
        validade,
        premissas,
        exclusoes,
        observacoes: obsComerciais,
        responsavelId: responsavel.id,
        responsavelNome,
      }

      let id: string
      let numero: string
      if (editId) {
        await atualizarProposta(editId, input)
        id = editId
        const atual = await getProposta(editId)
        numero = atual?.numero ?? "—"
      } else {
        const res = await criarProposta(input)
        id = res.id
        numero = res.numero
      }
      setPropostaId(id)

      // Auditoria de precificação + snapshot de versão (PRD 005 / 14)
      await registrarAjustes(
        id,
        responsavel.id,
        itens.map((i) => ({ disciplinaId: i.id, disciplinaNome: i.disciplina, valorSugerido: i.sugerido, valorFinal: i.final, justificativa: i.justificativa })),
      ).catch(() => {})

      // Monta o documento pela FONTE ÚNICA (mesma usada pela lista/drawer),
      // a partir do que foi realmente persistido — download idêntico em qualquer origem.
      const bundle = await montarDocumento(id)
      if (!bundle) {
        toast.error("Proposta salva, mas não foi possível montar o documento para exportação.")
        return
      }
      setGeneratedDoc(bundle.doc as DocumentData)
      setDocBundle(bundle)
      await snapshotVersao(id, bundle.doc, totalFinal, responsavel.id).catch(() => {})

      clearDraft()
      setStep(8)
      toast.success(editId ? `Proposta ${numero} atualizada!` : `Proposta ${numero} gerada e salva com sucesso!`)
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível salvar a proposta. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  async function handleBaixarPdf() {
    if (!docBundle) return
    setExportando(true)
    try {
      baixarBlob(gerarPdf(docBundle.doc, docBundle.empresa), `${docBundle.doc.numero}.pdf`)
    } catch (e) {
      console.error(e)
      toast.error("Falha ao gerar o PDF.")
    } finally {
      setExportando(false)
    }
  }

  async function handleBaixarWord() {
    if (!docBundle) return
    setExportando(true)
    try {
      baixarBlob(await gerarWord(docBundle.doc, docBundle.empresa), `${docBundle.doc.numero}.docx`)
    } catch (e) {
      console.error(e)
      toast.error("Falha ao gerar o Word.")
    } finally {
      setExportando(false)
    }
  }

  // Envia por e-mail e devolve o resultado REAL ao compositor, que dirige os
  // estados (enviado/simulado/falhou). O status só vira "Enviada" em envio real.
  async function handleEnviarEmail(dados: {
    destinatario: string
    copias: string
    assunto: string
    corpo: string
    anexo: "pdf" | "word"
  }): Promise<ResultadoEnvio> {
    if (!propostaId || !docBundle) {
      return { ok: false, simulado: false, error: "Documento indisponível. Gere a proposta novamente." }
    }
    try {
      const blob = dados.anexo === "word" ? await gerarWord(docBundle.doc, docBundle.empresa) : gerarPdf(docBundle.doc, docBundle.empresa)
      const base64 = await blobParaBase64(blob)
      const res = await enviarProposta({
        propostaId,
        destinatario: dados.destinatario,
        copias: dados.copias ? dados.copias.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
        assunto: dados.assunto,
        corpo: dados.corpo,
        anexoTipo: dados.anexo,
        anexoNome: `${docBundle.doc.numero}.${dados.anexo === "word" ? "docx" : "pdf"}`,
        anexoBase64: base64,
        usuarioId: responsavel.id,
        usuarioNome: responsavel.nome,
      })
      // Status muda para "Enviada" APENAS em envio real (nem simulado, nem falha).
      if (res.ok && !res.simulado) {
        await transicionarStatus(propostaId, "Enviada").catch(() => {})
      }
      return res
    } catch (e) {
      return { ok: false, simulado: false, error: e instanceof Error ? e.message : "Falha ao enviar o e-mail." }
    }
  }

  if (!isLoaded) return null

  return (
    <Shell breadcrumb={["IEX", "Propostas", "Nova proposta"]}>
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 no-print">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{editId ? "Editar proposta" : "Nova proposta"}</h1>
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
                <RadioGroup value={tipoCliente} onValueChange={(v) => { setTipoCliente(v); if (v === "novo") { setClienteSel(""); setObrasDoCliente([]); setObraMode("nova") } }} className="flex gap-4">
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
                      <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                      <SelectContent>
                        {clientesList.map((c) => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {clienteSel && (
                      <p className="text-xs text-muted-foreground">
                        {obrasDoCliente.length
                          ? `${obrasDoCliente.length} obra(s) cadastrada(s) para este cliente.`
                          : "Nenhuma obra cadastrada ainda — você pode criar uma na próxima etapa."}
                      </p>
                    )}
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
                <StepTitle title="Obra" desc="O orçamento pertence a uma obra/empreendimento do cliente." />
                {obrasDoCliente.length > 0 && (
                  <RadioGroup
                    value={obraMode}
                    onValueChange={(v) => {
                      setObraMode(v as "existente" | "nova")
                      if (v === "nova") {
                        setObraSel("")
                        setNomeObra("")
                        setUrgencia("Normal")
                        setRepetitividade("Não se aplica")
                      }
                    }}
                    className="flex gap-4"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="existente" /> Obra existente
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="nova" /> Nova obra
                    </label>
                  </RadioGroup>
                )}
                {obraMode === "existente" && obrasDoCliente.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Selecionar obra</Label>
                    <Select value={obraSel} onValueChange={selectObra}>
                      <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
                      <SelectContent>
                        {obrasDoCliente.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.nome}{o.cidade ? ` — ${o.cidade}/${o.uf}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Edições nos campos abaixo atualizam o cadastro da obra.</p>
                  </div>
                )}
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
                  <FieldSelect label="Urgência" value={urgencia} onChange={setUrgencia} options={URGENCIAS} />
                  <FieldSelect label="Repetitividade de unidades" value={repetitividade} onChange={setRepetitividade} options={REPETITIVIDADES} />
                </div>
              </Card>
            )}

            {step === 2 && (
              <Card className="space-y-5 p-6">
                <StepTitle title="Disciplinas" desc="Selecione as disciplinas e ajuste o escopo de cada uma." />
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

                {selDisc.length > 0 && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-foreground">Escopo por disciplina</h3>
                      <p className="text-xs text-muted-foreground">Uma linha por item. O escopo entra no documento da proposta.</p>
                    </div>
                    {selDisc.map((id) => {
                      const d = dynamicDisciplinas.find((x) => x.id === id)
                      if (!d) return null
                      const valor = escoposTexto[id] ?? d.escopoPadrao.join("\n")
                      return (
                        <div key={id} className="space-y-1.5">
                          <Label className="text-sm">{d.nome}</Label>
                          <Textarea
                            value={valor}
                            rows={4}
                            onChange={(e) => setEscoposTexto((cur) => ({ ...cur, [id]: e.target.value }))}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )}

            {step === 3 && (
              <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                <Card className="space-y-6 p-6">
                  <StepTitle title="Complexidade" desc="Avalie as variáveis do projeto para ajuste de rate card. Etapa opcional." />
                  <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Pular complexidade</Label>
                      <p className="text-xs text-muted-foreground">Orçamentos simples podem ignorar esta etapa (multiplicador 1,00x).</p>
                    </div>
                    <Switch checked={pularComplexidade} onCheckedChange={setPularComplexidade} />
                  </div>
                  {!pularComplexidade && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {variaveis.map((v) => {
                        const options = Object.keys(v.opcoes)
                        return (
                          <div key={v.chave} className="space-y-1.5">
                            <Label className="text-sm">{v.nome}</Label>
                            <Select value={comp[v.chave] ?? ""} onValueChange={(val) => setComp((c) => ({ ...c, [v.chave]: val }))}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {options.map((o) => <SelectItem key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      })}
                    </div>
                  )}
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
                      const d = dynamicDisciplinas.find((x) => x.id === i.id)
                      if (!d) return null
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
                    <FieldSelect
                      label="Forma de pagamento"
                      value={formaPgto}
                      onChange={(v) => { setFormaPgto(v); setParcelas(parcelasPadrao(v)) }}
                      options={Array.from(new Set([...formasPagamento, formaPgto].filter(Boolean)))}
                    />
                    <FieldInput label="Prazo de execução" value={prazoExec} onChange={setPrazoExec} />
                    <FieldInput label="Validade da proposta" value={validade} onChange={setValidade} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Estrutura de pagamento (parcelas / marcos)</Label>
                      <Button variant="ghost" size="sm" onClick={redefinirParcelas}>Redefinir pela forma</Button>
                    </div>
                    <div className="space-y-2">
                      {parcelas.map((p, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_72px_84px_110px_36px] items-center gap-2">
                          <Input
                            value={p.descricao}
                            placeholder="Descrição"
                            onChange={(e) => setParcela(idx, { descricao: e.target.value })}
                            className="h-9"
                          />
                          <div className="relative">
                            <Input
                              type="number"
                              value={p.percentual}
                              onChange={(e) => setParcela(idx, { percentual: Number(e.target.value) || 0 })}
                              className="h-9 pr-6 text-right tabular-nums"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={p.marco}
                              onChange={(e) => setParcela(idx, { marco: e.target.checked })}
                              className="h-3.5 w-3.5 accent-[var(--primary)]"
                            />
                            Marco/aprov.
                          </label>
                          <span className="text-right text-sm tabular-nums text-foreground">
                            {formatBRL(Math.round((totalFinal * (Number(p.percentual) || 0)) / 100))}
                          </span>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeParcela(idx)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={addParcela}>
                        <Plus className="h-4 w-4" /> Adicionar parcela
                      </Button>
                      <span className={cn("text-xs tabular-nums", somaPercentual === 100 ? "text-muted-foreground" : "text-warning")}>
                        Soma: {somaPercentual}%{somaPercentual !== 100 ? " (ideal 100%)" : ""}
                      </span>
                    </div>
                  </div>

                  <FieldTextareaControlled label="Premissas (encargos da contratada)" value={premissas} onChange={setPremissas} />
                  <FieldTextareaControlled label="Exclusões (encargos do contratante)" value={exclusoes} onChange={setExclusoes} />
                  <FieldTextareaControlled label="Observações comerciais" value={obsComerciais} onChange={setObsComerciais} />
                </Card>
                <Card className="h-fit space-y-3 p-5 lg:sticky lg:top-4">
                  <h4 className="text-sm font-semibold text-foreground">Resumo financeiro</h4>
                  <div className="space-y-2 text-sm">
                    <Row label="Total" value={formatBRL(totalFinal)} bold />
                    <Separator />
                    {parcelasDoc.map((p, i) => (
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
                <ReviewSection title="Obra">
                  <Row label="Obra" value={nomeObra} />
                  <Row label="Tipo · área" value={`${tipoEmp} · ${area.toLocaleString("pt-BR")} m²`} />
                  <Row label="Urgência · repetitividade" value={`${urgencia} · ${repetitividade}`} />
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
                  {parcelasDoc.map((p, i) => (
                    <Row key={i} label={p.desc} value={formatBRL(p.valor)} muted />
                  ))}
                  <Row label="Prazo · validade" value={`${prazoExec} · ${validade}`} />
                </ReviewSection>
                <div className="flex justify-end gap-3 mt-4">
                  <Button variant="outline" onClick={() => setStep(0)} disabled={salvando}>Revisar dados</Button>
                  <Button onClick={handleGerarProposta} disabled={salvando}>
                    <FileText className="h-4 w-4" /> {salvando ? "Gerando…" : "Gerar proposta"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Navegação (oculta no passo Documento) */}
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleBaixarWord} disabled={exportando || !docBundle}>
                <Download className="h-4 w-4" /> Word
              </Button>
              <Button variant="outline" onClick={handleBaixarPdf} disabled={exportando || !docBundle}>
                <Download className="h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
            </div>
          </div>
          <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
            <DocumentPreview data={generatedDoc} />
            <div className="no-print">
              <EmailComposer
                destinatarioInicial={email}
                numero={generatedDoc.numero}
                empreendimento={nomeObra}
                onEnviar={handleEnviarEmail}
              />
            </div>
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

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
