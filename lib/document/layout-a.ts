import type { DadosBancarios } from "@/lib/db/types"
import type { PropostaDoc } from "./tipos"

// Layout "Modelo A v2" do documento da proposta (spec 2026-10-01). Fonte
// única de paleta, conteúdo institucional fixo e regras puras usadas pelo PDF
// (pdf.ts), pela prévia (document-preview.tsx) e pelo Word (word.ts). Nada
// aqui depende de jsPDF, docx ou React.

export const PALETA = {
  navyCapa: "#0f1c33",
  navy: "#1f3152",
  painel: "#172b4d",
  dourado: "#c09a55",
  douradoSuave: "#f3ebdc",
  azulClaro: "#75c2e3",
  tinta: "#1d2433",
  cinza: "#6b7486",
  cinzaClaro: "#a5aab4",
  texto: "#3b4456",
  textoCard: "#4a5366",
  linha: "#e3e7ee",
  faixa: "#f4f6fa",
  branco: "#ffffff",
  suaveNoNavy: "#b7c0cf",
  suaveNoPainel: "#c4cad6",
  divisorPainel: "#34466a",
  bordaChip: "#4a5670",
  verde: "#2f7d5b",
  vermelho: "#b0564a",
} as const

export const ICONES = [
  "eletrica", "hidraulica", "sanitaria", "incendio", "climatizacao", "spda", "dados", "gas",
  "estrutura", "fotovoltaica", "generico", "bim", "quantitativos", "aprovacoes",
] as const
export type IconeId = (typeof ICONES)[number]

// Conteúdo fixo da IEX (decisão da spec: trocar exige deploy).
export const INSTITUCIONAL = {
  // Texto enviado pela IEX (revisão de 01/10/2026). "assim" → "assinam".
  quemSomos: [
    "Em 2013 nasceu a IEX PROJETOS, a união do pai Alderi Sousa com o filho João Paulo, com a proposta de levar ao mercado uma empresa que entregue ao cliente solução completa em projetos de instalações de forma rápida, segura e compatibilizada, e com agilidade gerando menor custo e velocidade nas obras de forma responsável.",
    "A IEX traz o conceito de Solidez, Qualidade, Credibilidade e Inovação em cada projeto que seus profissionais assinam, pois é formada por engenheiros projetistas especializados em cada disciplina, iniciando desde os projetos de terraplenagem, até os projetos de climatização. Todos os projetos são desenvolvidos e pensados em levar aos clientes eficiência e economia em suas obras.",
  ],
  socios: "Alderi Sousa e João Paulo",
  sociosLegenda: "Sócios fundadores",
  numeros: [
    { prefixo: "+ de", valor: "1.400", rotulo: "Projetos aprovados" },
    { prefixo: "", valor: "32", rotulo: "Hospitais e clínicas" },
    { prefixo: "+ de", valor: "600", rotulo: "Lojas em 36 shopping centers" },
  ],
  metodologiaChamada: "100% dos projetos nascem em BIM",
  diferenciais: [
    { icone: "bim", titulo: "BIM integrado", texto: "Todas as disciplinas no mesmo modelo: interferências resolvidas antes da obra." },
    { icone: "quantitativos", titulo: "Quantitativos precisos", texto: "Planilhas de materiais que viram base para orçamento, compras e controle de custo." },
    { icone: "aprovacoes", titulo: "Aprovações", texto: "Aprovação junto à CAGECE, à ENEL e ao Corpo de Bombeiros." },
  ],
  especialidades: [
    { titulo: "Instalações elétricas", itens: ["Baixa tensão e IT médico", "Subestações aéreas e abrigadas", "Redes de distribuição", "SPDA, dados e CFTV"] },
    { titulo: "Instalações civis", itens: ["Hidrossanitário", "Tratamento de água e esgoto", "Combate a incêndio com aprovação nos bombeiros"] },
    { titulo: "Instalações mecânicas", itens: ["Ar-condicionado", "Exaustão de cozinhas", "Redes de gases combustíveis e medicinais"] },
    { titulo: "Estruturas", itens: ["Concreto armado", "Alvenaria estrutural", "Estruturas metálicas", "Estruturas em madeira"] },
  ],
} as const satisfies {
  diferenciais: readonly { icone: IconeId; titulo: string; texto: string }[]
  [k: string]: unknown
}

export const APRESENTACAO_PADRAO =
  "Apresentamos a seguir o preço e as condições comerciais e técnicas para a elaboração dos projetos executivos de engenharia da obra em referência."
export const RODAPE_PADRAO = "Powered by YRM Strategy Lab"
export const EMPRESA_PADRAO = {
  razaoSocial: "IEX Projetos",
  endereco: "Rua Monsenhor Bruno, 1153, Salas 804/806 — Aldeota, Fortaleza/CE",
  telefone: "(85) 99921-8630",
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export function tituloCapa(empreendimento: string): string[] {
  const partes = (empreendimento ?? "").split(" — ").map((p) => p.trim()).filter(Boolean)
  return partes.length ? partes : ["Proposta comercial"]
}

const PREFIXOS = [/^instala[cç][aã]o(es)?\s+/i, /^instala[cç][oõ]es\s+/i, /^projetos?\s+de\s+/i, /^preven[cç][aã]o\s+e\s+combate\s+a\s+/i]
// Preposição que sobra depois de tirar um prefixo ("Instalações de gás" → "de gás").
const PREPOSICAO_INICIAL = /^(de|da|do|das|dos)\s+/i

function nomeCurto(disciplina: string): string {
  let nome = disciplina.trim()
  // Repete até estabilizar: "Projeto de instalações elétricas" perde dois prefixos.
  for (let anterior = ""; anterior !== nome; ) {
    anterior = nome
    for (const p of PREFIXOS) nome = nome.replace(p, "")
    nome = nome.replace(PREPOSICAO_INICIAL, "")
  }
  // Siglas (SPDA, CFTV) ficam em caixa alta; o resto começa minúsculo.
  return /^[A-Z0-9]{2,}\b/.test(nome) ? nome : nome.charAt(0).toLowerCase() + nome.slice(1)
}

// Acima de MAX_NOMES_CAPA disciplinas a capa lista só as primeiras e resume o
// resto: com 18 títulos reais a lista inteira passava de 10 linhas.
const MAX_NOMES_CAPA = 6
const NOMES_NO_RESUMO = 5

export function subtituloCapa(itens: { disciplina: string }[]): string {
  const nomes = itens.map((i) => nomeCurto(i.disciplina)).filter(Boolean)
  if (!nomes.length) return "Projetos executivos de engenharia."
  if (nomes.length > MAX_NOMES_CAPA) {
    return `Projetos executivos de: ${nomes.slice(0, NOMES_NO_RESUMO).join(", ")} e mais ${nomes.length - NOMES_NO_RESUMO} disciplinas.`
  }
  const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`
  return `Projetos executivos de: ${lista}.`
}

// A ordem importa: "hidrossanitário" é hidráulica, "águas pluviais" é
// sanitária, "rede de gases" é gás.
const REGRAS_ICONE: [RegExp, IconeId][] = [
  [/spda/, "spda"],
  [/fotovolt|solar/, "fotovoltaica"],
  [/cftv|dados|telecom|\blogica/, "dados"],
  [/\bgas\b|gases|glp/, "gas"],
  [/hidross/, "hidraulica"],
  [/sanit|esgoto|pluvia|drenag/, "sanitaria"],
  [/hidraul|agua/, "hidraulica"],
  [/incend|bombeir|alarme/, "incendio"],
  [/climat|ar.condicionado|exaust|ventila/, "climatizacao"],
  [/eletric|subesta|luminot/, "eletrica"],
  [/estrut|fundac|sondag|concreto/, "estrutura"],
]

export function iconeDisciplina(nome: string): IconeId {
  const n = semAcento(nome ?? "")
  return REGRAS_ICONE.find(([re]) => re.test(n))?.[1] ?? "generico"
}

export function percentual(valor: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.round((valor / total) * 1000) / 10
}

export function formatarPercentual(p: number): string {
  return `${p.toLocaleString("pt-BR")}%`
}

// As parcelas salvas já trazem o percentual na descrição ("... (30%)"). O
// layout mostra o percentual numa etiqueta, então ele sai do rótulo.
export function rotuloParcela(desc: string): string {
  const marco = /\(marco\s*—\s*[\d.,]+%\)\s*$/i.test(desc)
  const limpo = desc.replace(/\s*\((?:marco\s*—\s*)?[\d.,]+%\)\s*$/i, "").trim()
  return marco ? `${limpo} · marco` : limpo
}

export function formatarArea(area: number): string {
  return `${area.toLocaleString("pt-BR")} m²`
}

export function fichaEmpreendimento(
  doc: Pick<PropostaDoc, "cliente" | "contato" | "tipo" | "cidade" | "uf" | "area" | "itens">,
): [string, string][] {
  const n = doc.itens.length
  const campos: [string, string][] = [
    ["Cliente", doc.cliente ?? ""],
    ["Contato", doc.contato ?? ""],
    ["Tipologia", doc.tipo ?? ""],
    ["Localização", [doc.cidade, doc.uf].filter((v) => v?.trim()).join("/")],
    ["Área total", doc.area > 0 ? formatarArea(doc.area) : ""],
    ["Disciplinas", n > 0 ? `${n} ${n === 1 ? "projeto" : "projetos"}` : ""],
  ]
  return campos.filter(([, v]) => v.trim())
}

export function linhasBancarias(b: DadosBancarios | null | undefined): string[] {
  if (!b) return []
  const conta = [b.agencia && `Ag. ${b.agencia}`, b.conta && `C/C ${b.conta}`].filter(Boolean).join(" · ")
  return [b.banco, conta, b.pix && `PIX ${b.pix}`, b.favorecido].filter((v): v is string => !!v && !!v.trim())
}

export function contatoRodape(e: { razaoSocial?: string; endereco?: string; telefone?: string }): string {
  return [
    e.razaoSocial?.trim() || EMPRESA_PADRAO.razaoSocial,
    e.endereco?.trim() || EMPRESA_PADRAO.endereco,
    e.telefone?.trim() || EMPRESA_PADRAO.telefone,
  ].join(" · ")
}

export function dataPorExtenso(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
}

export function mesAno(d: Date): string {
  return `${d.toLocaleDateString("pt-BR", { month: "long" })}/${d.getFullYear()}`
}

export interface BlocoPaginavel {
  altura: number
  quebraAntes?: boolean
  manterComProximo?: boolean
}

// Distribui blocos de altura conhecida em páginas. Um bloco que não cabe
// abre página nova; `manterComProximo` exige espaço para o bloco e para os
// seguintes da cadeia (título nunca fica órfão); um bloco maior que a área
// útil ocupa uma página sozinho.
export function paginar(blocos: BlocoPaginavel[], alturaUtil: number): number[][] {
  const paginas: number[][] = []
  let atual: number[] = []
  let usado = 0
  const fechar = () => {
    if (atual.length) paginas.push(atual)
    atual = []
    usado = 0
  }
  blocos.forEach((bloco, i) => {
    if (bloco.quebraAntes) fechar()
    let exigida = bloco.altura
    for (let j = i; blocos[j]?.manterComProximo && blocos[j + 1] && !blocos[j + 1].quebraAntes; j++) {
      exigida += blocos[j + 1].altura
    }
    if (atual.length && usado + exigida > alturaUtil) fechar()
    atual.push(i)
    usado += bloco.altura
    if (usado > alturaUtil) fechar()
  })
  fechar()
  return paginas
}
