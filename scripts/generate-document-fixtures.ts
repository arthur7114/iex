import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { gerarPdf } from "../lib/document/pdf"
import { gerarWord } from "../lib/document/word"
import type { EmpresaDoc, PropostaDoc } from "../lib/document/tipos"

const outputDir = resolve(process.argv[2] || "tmp/document-qa")

const empresa: EmpresaDoc = {
  razaoSocial: "IEX Projetos Ltda",
  cnpj: "45.546.897/0001-91",
  endereco: "Rua Monsenhor Bruno, 1153 - Fortaleza/CE",
  telefone: "(85) 99921-8630",
  email: "propostas@iexprojetos.com",
  textoRodape: "Powered by YRM Strategy Lab",
  dadosBancarios: {
    banco: "Caixa Econômica Federal",
    agencia: "1977",
    conta: "575083929-6",
    pix: "45.546.897/0001-91",
    favorecido: "IEX Projetos Ltda",
  },
  corPrimaria: "243658",
  corSecundaria: "C7A45A",
}

const apresentacao =
  "A IEX Projetos desenvolve projetos de engenharia de forma integrada, com foco na compatibilização entre disciplinas, no atendimento às normas técnicas e na produção de documentação executiva clara para apoiar a execução da obra. Apresentamos, a seguir, o escopo, o investimento e as condições comerciais e técnicas dos serviços selecionados."

const nomes = [
  "Climatização - Splits / VRF",
  "Exaustão e ventilação mecânica",
  "Instalações elétricas de baixa tensão",
  "Cabeamento estruturado - dados e voz",
  "Sistema de monitoramento CFTV",
  "Detecção, alarme e combate a incêndio",
  "SPDA",
  "Instalações hidráulicas - água fria",
  "Instalações sanitárias - esgoto",
  "Instalações de águas pluviais",
  "Instalações de gás",
  "Cálculo estrutural em concreto",
  "Sondagem",
  "Energia fotovoltaica",
  "Projeto estrutural",
  "Subestação elétrica abrigada",
  "Grupo gerador",
  "Cálculo estrutural metálico",
]

function escopo(indice: number, longo = false): string[] {
  const base = [
    `Dimensionamento e detalhamento técnico do sistema ${indice + 1}.`,
    "Compatibilização com as demais disciplinas do empreendimento.",
    "Especificação dos materiais, equipamentos e critérios normativos aplicáveis.",
    "Emissão da documentação executiva nos formatos previstos no contrato.",
  ]
  return longo
    ? [
        ...base,
        "Verificação das interferências com arquitetura, estrutura e instalações complementares em todos os pavimentos.",
        "Consolidação das informações necessárias à execução da obra e ao processo de aprovação aplicável.",
      ]
    : base
}

function baseDoc(nome: string): PropostaDoc {
  return {
    numero: "20260727-01",
    versao: 2,
    apresentacao,
    cliente: "Condomínio Residencial Atlântico",
    contato: "Mariana Carvalho",
    empreendimento: nome,
    cidade: "Fortaleza",
    uf: "CE",
    area: 12_450,
    tipo: "Condomínio residencial",
    itens: [],
    total: 0,
    formaPagamento: "40/40/20",
    parcelas: [
      { desc: "Sinal na aprovação (40%)", valor: 40_000 },
      { desc: "Entrega dos executivos (40%)", valor: 40_000 },
      { desc: "Aprovações finais (20%)", valor: 20_000 },
    ],
    prazoExecucao: "60 dias úteis",
    validade: "20 dias corridos",
    premissas: [
      "Projeto executivo detalhado e compatibilizado.",
      "Memorial técnico descritivo e especificações de materiais.",
      "Planilha quantitativa de materiais.",
      "Entrega dos arquivos digitais nos formatos DWG, IFC e PDF.",
      "Fornecimento de ART junto ao CREA-CE.",
    ],
    exclusoes: [
      "Taxas e emolumentos de aprovação em órgãos fiscalizadores.",
      "Projetos e serviços não listados no escopo desta proposta.",
      "Alterações de escopo posteriores à aprovação formal.",
    ],
    observacoes: "",
    responsavel: "Arthur Brito",
  }
}

const curto = baseDoc("Residencial Atlântico - Bloco A")
curto.itens = [{ disciplina: nomes[2], valor: 8_500, escopo: escopo(2).slice(0, 2) }]
curto.total = 8_500
curto.parcelas = [
  { desc: "Sinal na aprovação (40%)", valor: 3_400 },
  { desc: "Entrega dos executivos (40%)", valor: 3_400 },
  { desc: "Aprovações finais (20%)", valor: 1_700 },
]

const longo = baseDoc("Complexo Residencial Atlântico - Torres A, B e C")
longo.itens = nomes.slice(0, 8).map((disciplina, indice) => ({
  disciplina,
  valor: 12_500 + indice * 1_350,
  escopo: escopo(indice, true),
}))
longo.total = longo.itens.reduce((soma, item) => soma + item.valor, 0)
longo.premissas = Array.from({ length: 13 }, (_, indice) =>
  `Premissa técnica ${indice + 1}: documentação, compatibilização e validação necessárias ao desenvolvimento integrado dos projetos contratados.`,
)
longo.exclusoes = Array.from({ length: 10 }, (_, indice) =>
  `Exclusão ${indice + 1}: serviço complementar não descrito expressamente no escopo comercial desta proposta.`,
)
longo.observacoes =
  "Os prazos de concessionárias e órgãos públicos não integram o prazo de produção da IEX. Revisões decorrentes de mudança de escopo serão avaliadas comercialmente antes da execução."

const completo = baseDoc("Condomínio Parque das Dunas")
completo.itens = nomes.map((disciplina, indice) => ({
  disciplina,
  valor: 4_000 + indice * 650,
  escopo: escopo(indice),
}))
completo.total = completo.itens.reduce((soma, item) => soma + item.valor, 0)

async function main() {
  await mkdir(outputDir, { recursive: true })

  for (const [nome, documento] of [
    ["curto", curto],
    ["longo", longo],
    ["18-disciplinas", completo],
  ] as const) {
    const pdf = gerarPdf(documento, empresa)
    const word = await gerarWord(documento, empresa)
    await Promise.all([
      writeFile(resolve(outputDir, `${nome}.pdf`), Buffer.from(await pdf.arrayBuffer())),
      writeFile(resolve(outputDir, `${nome}.docx`), Buffer.from(await word.arrayBuffer())),
    ])
  }

  console.log(outputDir)
}

void main()
