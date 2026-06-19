export type StatusProposta =
  | "Em elaboração"
  | "Enviada"
  | "Aprovada"
  | "Perdida"

export type MotivoPerda =
  | "Preço alto"
  | "Cliente escolheu concorrente"
  | "Projeto cancelado"
  | "Sem retorno"
  | "Prazo incompatível"
  | "Escopo mudou"
  | "Cliente sem orçamento"

export interface Disciplina {
  id: string
  nome: string
  descricao: string
  valorBaseM2: number
  valorMinimo: number
  exigeAprovacao: boolean
  escopoPadrao: string[]
}

export interface Cliente {
  id: string
  razaoSocial: string
  contato: string
  email: string
  telefone: string
  origem: string
  perfil: string
  cidade: string
  uf: string
  propostasEnviadas: number
  propostasAprovadas: number
  valorAprovado: number
  ultimaProposta: string
}

export interface ItemProposta {
  disciplinaId: string
  disciplina: string
  valorSugerido: number
  valorFinal: number
  justificativa?: string
}

export interface Proposta {
  id: string
  numero: string
  cliente: string
  clienteId: string
  obraId?: string
  empreendimento: string
  tipo: string
  cidade: string
  uf: string
  area: number
  disciplinas: string[]
  itens: ItemProposta[]
  valorSugerido: number
  valorFinal: number
  status: StatusProposta
  responsavel: string
  origem: string
  dataCriacao: string
  dataEnvio: string | null
  ultimaAtualizacao: string
  diasSemRetorno: number
  motivoPerda?: MotivoPerda
  proximosPassos: string
  historico: { data: string; usuario: string; acao: string }[]
}

export const disciplinas: Disciplina[] = [
  {
    id: "climatizacao-splits-vrf",
    nome: "Climatização — Splits / VRF",
    descricao: "Projeto de sistema de climatização para ambientes atendidos.",
    valorBaseM2: 1.35,
    valorMinimo: 3000,
    exigeAprovacao: false,
    escopoPadrao: [
      "Definição de equipamentos.",
      "Rede de tubulações frigoríferas.",
      "Drenos e pontos de alimentação específicos.",
      "Compatibilização com ambientes climatizados."
    ]
  },
  {
    id: "exaustao-ventilacao",
    nome: "Exaustão e ventilação mecânica",
    descricao: "Projeto de renovação de ar, exaustão e ventilação mecânica.",
    valorBaseM2: 0.66,
    valorMinimo: 2500,
    exigeAprovacao: false,
    escopoPadrao: [
      "Definição de equipamentos exaustores e ventiladores.",
      "Rede de dutos de insuflamento e exaustão.",
      "Distribuição de ar por grelhas, difusores ou venezianas.",
      "Atendimento às áreas técnicas necessárias."
    ]
  },
  {
    id: "eletrica-bt",
    nome: "Instalações elétricas de baixa tensão",
    descricao: "Projeto elétrico de iluminação, tomadas, alimentadores e quadros.",
    valorBaseM2: 1.52,
    valorMinimo: 3500,
    exigeAprovacao: true,
    escopoPadrao: [
      "Iluminação e tomadas de uso geral e específico.",
      "Alimentadores de máquinas e climatização.",
      "Alimentadores de quadros elétricos.",
      "Diagramas, quadros elétricos e detalhamentos."
    ]
  },
  {
    id: "cabeamento-estruturado",
    nome: "Cabeamento estruturado — dados e voz",
    descricao: "Projeto de infraestrutura para dados, voz e redes internas.",
    valorBaseM2: 0.93,
    valorMinimo: 2500,
    exigeAprovacao: false,
    escopoPadrao: [
      "Quadros e racks de telecomunicações.",
      "Tubulações e pontos de dados.",
      "Infraestrutura para unidades consumidoras.",
      "Indicação de pontos e encaminhamentos principais."
    ]
  },
  {
    id: "cftv",
    nome: "Sistema de monitoramento CFTV",
    descricao: "Projeto de posicionamento e infraestrutura para câmeras.",
    valorBaseM2: 0.75,
    valorMinimo: 2500,
    exigeAprovacao: false,
    escopoPadrao: [
      "Indicação de tipos e quantidades de câmeras.",
      "Posicionamento dos pontos de vigilância.",
      "Infraestrutura para equipamentos de gravação.",
      "Compatibilização com cabeamento estruturado."
    ]
  },
  {
    id: "incendio",
    nome: "Detecção, alarme e combate de incêndio",
    descricao: "Projeto de segurança contra incêndio e pânico.",
    valorBaseM2: 2.23,
    valorMinimo: 4000,
    exigeAprovacao: true,
    escopoPadrao: [
      "Rede de detecção e alarme.",
      "Iluminação de emergência.",
      "Hidrantes, extintores e rotas de fuga.",
      "Apoio ao processo de aprovação junto ao Corpo de Bombeiros."
    ]
  },
  {
    id: "spda",
    nome: "SPDA — Sistema de Proteção contra Descarga Atmosférica",
    descricao: "Projeto de sistema de para-raios, aterramento e proteção.",
    valorBaseM2: 2.81,
    valorMinimo: 3500,
    exigeAprovacao: false,
    escopoPadrao: [
      "Malha de captação e descidas.",
      "Aterramentos.",
      "Equipamentos e conexões.",
      "Sinalização e detalhamento técnico."
    ]
  },
  {
    id: "hidraulica",
    nome: "Instalações hidráulicas",
    descricao: "Projeto de distribuição de água fria e pontos hidráulicos.",
    valorBaseM2: 0.78,
    valorMinimo: 3000,
    exigeAprovacao: false,
    escopoPadrao: [
      "Rede de distribuição de água fria.",
      "Caixas d’água, cisternas e pontos de consumo.",
      "Registros e dispositivos hidráulicos.",
      "Detalhamento executivo."
    ]
  },
  {
    id: "sanitaria",
    nome: "Instalações sanitárias",
    descricao: "Projeto de esgoto sanitário e encaminhamento de tubulações.",
    valorBaseM2: 0.78,
    valorMinimo: 3000,
    exigeAprovacao: false,
    escopoPadrao: [
      "Rede de tubulação de esgoto.",
      "Atendimento a banheiros, copas, pias e drenos.",
      "Ligação à rede pública, quando aplicável.",
      "Detalhamento executivo."
    ]
  },
  {
    id: "aguas-pluviais",
    nome: "Águas pluviais",
    descricao: "Projeto de captação e destinação de águas pluviais.",
    valorBaseM2: 0.92,
    valorMinimo: 2500,
    exigeAprovacao: false,
    escopoPadrao: [
      "Captação de águas pluviais.",
      "Condutores verticais e horizontais.",
      "Destino para sarjetas, reservatórios ou reuso.",
      "Detalhamento executivo."
    ]
  },
  {
    id: "gas",
    nome: "Instalações de gás GLP ou natural",
    descricao: "Projeto de rede de gás para unidades e áreas atendidas.",
    valorBaseM2: 1.2,
    valorMinimo: 3000,
    exigeAprovacao: false,
    escopoPadrao: [
      "Tubulações para gás GLP ou natural.",
      "Pontos de consumo.",
      "Sistema individual ou coletivo, conforme empreendimento.",
      "Detalhamento técnico da infraestrutura."
    ]
  },
  {
    id: "estrutural-concreto",
    nome: "Cálculo estrutural em concreto",
    descricao: "Projeto estrutural em concreto moldado in loco ou pré-moldado.",
    valorBaseM2: 5.0,
    valorMinimo: 6000,
    exigeAprovacao: false,
    escopoPadrao: [
      "Fundações.",
      "Pilares, vigas e lajes.",
      "Elementos estruturais necessários.",
      "Detalhamento executivo estrutural."
    ]
  },
  {
    id: "sondagem",
    nome: "Sondagem",
    descricao: "Serviços de sondagem do solo para análise do terreno.",
    valorBaseM2: 0,
    valorMinimo: 6900,
    exigeAprovacao: false,
    escopoPadrao: [
      "Perfuração do solo.",
      "Análise do tipo de terreno.",
      "Identificação de condições para decisão de fundação.",
      "Relatório técnico de sondagem."
    ]
  }
]

export const tiposEmpreendimento = [
  "Hospital",
  "Hotel",
  "Clínica",
  "Loja comercial",
  "Residencial",
  "Condomínio",
  "Indústria",
  "Escola",
  "Galpão",
  "Retrofit/Reforma",
]

export const origensCliente = [
  "Indicação",
  "Site institucional",
  "Cliente recorrente",
  "Prospecção ativa",
  "Parceria com arquiteto",
  "Evento / feira",
]

export const perfisCliente = [
  "Estratégico",
  "Recorrente",
  "Novo",
  "Sensível a preço",
  "Institucional",
]

export const motivosPerda: MotivoPerda[] = [
  "Preço alto",
  "Cliente escolheu concorrente",
  "Projeto cancelado",
  "Sem retorno",
  "Prazo incompatível",
  "Escopo mudou",
  "Cliente sem orçamento",
]

export const formasPagamento = [
  "À vista",
  "Entrada + parcelas",
  "Por marcos de projeto",
  "30/60/90 dias",
  "Mensal durante a obra",
]

export const responsaveis = [
  "Ricardo Almeida",
  "Patrícia Nunes",
  "Eduardo Tavares",
  "Camila Rocha",
]

export const clientes: Cliente[] = [
  { id: "c1", razaoSocial: "Hospital São Lucas", contato: "Dr. Henrique Souza", email: "compras@saolucas.com.br", telefone: "(81) 3221-4500", origem: "Indicação", perfil: "Institucional", cidade: "Recife", uf: "PE", propostasEnviadas: 6, propostasAprovadas: 4, valorAprovado: 1280000, ultimaProposta: "2026-05-18" },
  { id: "c2", razaoSocial: "Grupo Atlântico Hotéis", contato: "Marcos Vinícius", email: "engenharia@atlantico.com", telefone: "(85) 3045-9920", origem: "Cliente recorrente", perfil: "Estratégico", cidade: "Fortaleza", uf: "CE", propostasEnviadas: 9, propostasAprovadas: 6, valorAprovado: 2140000, ultimaProposta: "2026-05-22" },
  { id: "c3", razaoSocial: "Clínica Vida Plena", contato: "Dra. Renata Lima", email: "adm@vidaplena.com.br", telefone: "(81) 3877-1200", origem: "Parceria com arquiteto", perfil: "Recorrente", cidade: "Recife", uf: "PE", propostasEnviadas: 4, propostasAprovadas: 2, valorAprovado: 410000, ultimaProposta: "2026-05-10" },
  { id: "c4", razaoSocial: "Condomínio Reserva das Dunas", contato: "Síndico João Bezerra", email: "sindico@reservadunas.com", telefone: "(84) 3232-7711", origem: "Indicação", perfil: "Sensível a preço", cidade: "Natal", uf: "RN", propostasEnviadas: 3, propostasAprovadas: 1, valorAprovado: 185000, ultimaProposta: "2026-04-29" },
  { id: "c5", razaoSocial: "Arq. Mariana Teixeira", contato: "Mariana Teixeira", email: "contato@marianateixeira.arq.br", telefone: "(81) 99812-3344", origem: "Parceria com arquiteto", perfil: "Recorrente", cidade: "Recife", uf: "PE", propostasEnviadas: 7, propostasAprovadas: 5, valorAprovado: 620000, ultimaProposta: "2026-05-20" },
  { id: "c6", razaoSocial: "Indústria Nordeste Foods", contato: "Eng. Paulo Cardoso", email: "projetos@nordestefoods.com", telefone: "(81) 3461-8800", origem: "Prospecção ativa", perfil: "Estratégico", cidade: "Cabo de Sto. Agostinho", uf: "PE", propostasEnviadas: 5, propostasAprovadas: 3, valorAprovado: 1730000, ultimaProposta: "2026-05-15" },
  { id: "c7", razaoSocial: "Arquiteto Diego Lopes", contato: "Diego Lopes", email: "diego@example.com", telefone: "(88) 99999-0000", origem: "Site institucional", perfil: "Novo", cidade: "Sobral", uf: "CE", propostasEnviadas: 0, propostasAprovadas: 0, valorAprovado: 0, ultimaProposta: "" },
]

export const propostas: Proposta[] = [
  {
    id: "p1", numero: "PRP-2026-0142", cliente: "Hospital São Lucas", clienteId: "c1",
    empreendimento: "Ampliação Ala Cirúrgica", tipo: "Hospital", cidade: "Recife", uf: "PE", area: 3200,
    disciplinas: ["Instalações elétricas", "Hidráulica", "Incêndio", "Climatização"],
    itens: [
      { disciplinaId: "ele", disciplina: "Instalações elétricas", valorSugerido: 30400, valorFinal: 30400 },
      { disciplinaId: "hid", disciplina: "Hidráulica", valorSugerido: 23040, valorFinal: 23040 },
      { disciplinaId: "inc", disciplina: "Incêndio", valorSugerido: 25920, valorFinal: 27500, justificativa: "Escopo exige compatibilização adicional." },
      { disciplinaId: "cli", disciplina: "Climatização", valorSugerido: 37120, valorFinal: 39000 },
    ],
    valorSugerido: 116480, valorFinal: 119940, status: "Enviada", responsavel: "Ricardo Almeida", origem: "Indicação",
    dataCriacao: "2026-05-12", dataEnvio: "2026-05-18", ultimaAtualizacao: "2026-05-18", diasSemRetorno: 14,
    proximosPassos: "Aguardando retorno da diretoria clínica.",
    historico: [
      { data: "2026-05-12", usuario: "Ricardo Almeida", acao: "Proposta criada" },
      { data: "2026-05-16", usuario: "Ricardo Almeida", acao: "Ajuste de valor em Incêndio" },
      { data: "2026-05-18", usuario: "Ricardo Almeida", acao: "Proposta enviada por e-mail" },
    ],
  },
  {
    id: "p2", numero: "PRP-2026-0145", cliente: "Grupo Atlântico Hotéis", clienteId: "c2",
    empreendimento: "Resort Praia Mansa - Bloco B", tipo: "Hotel", cidade: "Fortaleza", uf: "CE", area: 8600,
    disciplinas: ["Instalações elétricas", "Hidráulica", "Sanitária", "Climatização", "Fotovoltaica"],
    itens: [
      { disciplinaId: "ele", disciplina: "Instalações elétricas", valorSugerido: 81700, valorFinal: 81700 },
      { disciplinaId: "hid", disciplina: "Hidráulica", valorSugerido: 61920, valorFinal: 58000, justificativa: "Cliente recorrente com negociação estratégica." },
      { disciplinaId: "san", disciplina: "Sanitária", valorSugerido: 55040, valorFinal: 52000 },
      { disciplinaId: "cli", disciplina: "Climatização", valorSugerido: 99760, valorFinal: 99760 },
      { disciplinaId: "fot", disciplina: "Fotovoltaica", valorSugerido: 59340, valorFinal: 59340 },
    ],
    valorSugerido: 357760, valorFinal: 350800, status: "Aprovada", responsavel: "Patrícia Nunes", origem: "Cliente recorrente",
    dataCriacao: "2026-05-08", dataEnvio: "2026-05-13", ultimaAtualizacao: "2026-05-22", diasSemRetorno: 0,
    proximosPassos: "Contrato assinado. Iniciar mobilização.",
    historico: [
      { data: "2026-05-08", usuario: "Patrícia Nunes", acao: "Proposta criada" },
      { data: "2026-05-13", usuario: "Patrícia Nunes", acao: "Proposta enviada por e-mail" },
      { data: "2026-05-22", usuario: "Patrícia Nunes", acao: "Status alterado para Aprovada" },
    ],
  },
  {
    id: "p3", numero: "PRP-2026-0151", cliente: "Clínica Vida Plena", clienteId: "c3",
    empreendimento: "Nova Unidade Boa Viagem", tipo: "Clínica", cidade: "Recife", uf: "PE", area: 1400,
    disciplinas: ["Instalações elétricas", "Hidráulica", "SPDA", "CFTV"],
    itens: [
      { disciplinaId: "ele", disciplina: "Instalações elétricas", valorSugerido: 13300, valorFinal: 13300 },
      { disciplinaId: "hid", disciplina: "Hidráulica", valorSugerido: 10080, valorFinal: 10080 },
      { disciplinaId: "spd", disciplina: "SPDA", valorSugerido: 3220, valorFinal: 3220 },
      { disciplinaId: "cft", disciplina: "CFTV", valorSugerido: 6300, valorFinal: 6300 },
    ],
    valorSugerido: 32900, valorFinal: 32900, status: "Em elaboração", responsavel: "Eduardo Tavares", origem: "Parceria com arquiteto",
    dataCriacao: "2026-05-24", dataEnvio: null, ultimaAtualizacao: "2026-05-27", diasSemRetorno: 0,
    proximosPassos: "Finalizar etapa de complexidade e revisar valores.",
    historico: [
      { data: "2026-05-24", usuario: "Eduardo Tavares", acao: "Proposta criada" },
      { data: "2026-05-27", usuario: "Eduardo Tavares", acao: "Disciplinas atualizadas" },
    ],
  },
  {
    id: "p4", numero: "PRP-2026-0138", cliente: "Condomínio Reserva das Dunas", clienteId: "c4",
    empreendimento: "Retrofit Área de Lazer", tipo: "Condomínio", cidade: "Natal", uf: "RN", area: 950,
    disciplinas: ["Instalações elétricas", "Hidráulica", "Incêndio"],
    itens: [
      { disciplinaId: "ele", disciplina: "Instalações elétricas", valorSugerido: 9025, valorFinal: 8200, justificativa: "Cliente sensível a preço, ajuste para fechamento." },
      { disciplinaId: "hid", disciplina: "Hidráulica", valorSugerido: 6840, valorFinal: 6200 },
      { disciplinaId: "inc", disciplina: "Incêndio", valorSugerido: 7695, valorFinal: 7000 },
    ],
    valorSugerido: 23560, valorFinal: 21400, status: "Perdida", responsavel: "Camila Rocha", origem: "Indicação",
    dataCriacao: "2026-04-20", dataEnvio: "2026-04-26", ultimaAtualizacao: "2026-05-09", diasSemRetorno: 0,
    motivoPerda: "Preço alto",
    proximosPassos: "Reavaliar abordagem comercial para próxima oportunidade.",
    historico: [
      { data: "2026-04-20", usuario: "Camila Rocha", acao: "Proposta criada" },
      { data: "2026-04-26", usuario: "Camila Rocha", acao: "Proposta enviada por e-mail" },
      { data: "2026-05-09", usuario: "Camila Rocha", acao: "Status alterado para Perdida — Preço alto" },
    ],
  },
  {
    id: "p5", numero: "PRP-2026-0149", cliente: "Indústria Nordeste Foods", clienteId: "c6",
    empreendimento: "Galpão Logístico e Câmaras Frias", tipo: "Indústria", cidade: "Cabo de Sto. Agostinho", uf: "PE", area: 12400,
    disciplinas: ["Instalações elétricas", "Incêndio", "SPDA", "Climatização", "Estrutura"],
    itens: [
      { disciplinaId: "ele", disciplina: "Instalações elétricas", valorSugerido: 117800, valorFinal: 117800 },
      { disciplinaId: "inc", disciplina: "Incêndio", valorSugerido: 100440, valorFinal: 105000, justificativa: "Prazo reduzido e maior risco operacional." },
      { disciplinaId: "spd", disciplina: "SPDA", valorSugerido: 28520, valorFinal: 28520 },
      { disciplinaId: "cli", disciplina: "Climatização", valorSugerido: 143840, valorFinal: 143840 },
      { disciplinaId: "est", disciplina: "Estrutura", valorSugerido: 183520, valorFinal: 183520 },
    ],
    valorSugerido: 574120, valorFinal: 578680, status: "Enviada", responsavel: "Ricardo Almeida", origem: "Prospecção ativa",
    dataCriacao: "2026-05-10", dataEnvio: "2026-05-15", ultimaAtualizacao: "2026-05-15", diasSemRetorno: 17,
    proximosPassos: "Cliente em análise interna de viabilidade.",
    historico: [
      { data: "2026-05-10", usuario: "Ricardo Almeida", acao: "Proposta criada" },
      { data: "2026-05-15", usuario: "Ricardo Almeida", acao: "Proposta enviada por e-mail" },
    ],
  },
  {
    id: "p6", numero: "PRP-2026-0153", cliente: "Arq. Mariana Teixeira", clienteId: "c5",
    empreendimento: "Residência Alto Padrão - Aldeia", tipo: "Residencial", cidade: "Camaragibe", uf: "PE", area: 680,
    disciplinas: ["Instalações elétricas", "Hidráulica", "Climatização", "Fotovoltaica"],
    itens: [
      { disciplinaId: "ele", disciplina: "Instalações elétricas", valorSugerido: 6460, valorFinal: 6460 },
      { disciplinaId: "hid", disciplina: "Hidráulica", valorSugerido: 4896, valorFinal: 4896 },
      { disciplinaId: "cli", disciplina: "Climatização", valorSugerido: 7888, valorFinal: 7888 },
      { disciplinaId: "fot", disciplina: "Fotovoltaica", valorSugerido: 4692, valorFinal: 4692 },
    ],
    valorSugerido: 23936, valorFinal: 23936, status: "Aprovada", responsavel: "Patrícia Nunes", origem: "Parceria com arquiteto",
    dataCriacao: "2026-05-14", dataEnvio: "2026-05-16", ultimaAtualizacao: "2026-05-20", diasSemRetorno: 0,
    proximosPassos: "Projeto em desenvolvimento.",
    historico: [
      { data: "2026-05-14", usuario: "Patrícia Nunes", acao: "Proposta criada" },
      { data: "2026-05-16", usuario: "Patrícia Nunes", acao: "Proposta enviada por e-mail" },
      { data: "2026-05-20", usuario: "Patrícia Nunes", acao: "Status alterado para Aprovada" },
    ],
  },
  {
    id: "p7", numero: "PRP-2026-0156", cliente: "Grupo Atlântico Hotéis", clienteId: "c2",
    empreendimento: "Reforma Lobby e Spa", tipo: "Retrofit/Reforma", cidade: "Fortaleza", uf: "CE", area: 1100,
    disciplinas: ["Instalações elétricas", "Hidráulica", "CFTV"],
    itens: [
      { disciplinaId: "ele", disciplina: "Instalações elétricas", valorSugerido: 10450, valorFinal: 10450 },
      { disciplinaId: "hid", disciplina: "Hidráulica", valorSugerido: 7920, valorFinal: 7920 },
      { disciplinaId: "cft", disciplina: "CFTV", valorSugerido: 4950, valorFinal: 4950 },
    ],
    valorSugerido: 23320, valorFinal: 23320, status: "Enviada", responsavel: "Camila Rocha", origem: "Cliente recorrente",
    dataCriacao: "2026-05-19", dataEnvio: "2026-05-23", ultimaAtualizacao: "2026-05-23", diasSemRetorno: 9,
    proximosPassos: "Follow-up agendado para esta semana.",
    historico: [
      { data: "2026-05-19", usuario: "Camila Rocha", acao: "Proposta criada" },
      { data: "2026-05-23", usuario: "Camila Rocha", acao: "Proposta enviada por e-mail" },
    ],
  },
  {
    id: "p8", numero: "PRP-2026-0158", cliente: "Hospital São Lucas", clienteId: "c1",
    empreendimento: "Central de Gases Medicinais", tipo: "Hospital", cidade: "Recife", uf: "PE", area: 420,
    disciplinas: ["Gás", "Incêndio", "SPDA"],
    itens: [
      { disciplinaId: "gas", disciplina: "Gás", valorSugerido: 1596, valorFinal: 1596 },
      { disciplinaId: "inc", disciplina: "Incêndio", valorSugerido: 3402, valorFinal: 3402 },
      { disciplinaId: "spd", disciplina: "SPDA", valorSugerido: 966, valorFinal: 966 },
    ],
    valorSugerido: 5964, valorFinal: 5964, status: "Em elaboração", responsavel: "Eduardo Tavares", origem: "Indicação",
    dataCriacao: "2026-05-28", dataEnvio: null, ultimaAtualizacao: "2026-05-29", diasSemRetorno: 0,
    proximosPassos: "Aguardando definição de escopo com o cliente.",
    historico: [
      { data: "2026-05-28", usuario: "Eduardo Tavares", acao: "Proposta criada" },
    ],
  },
]

export interface LogEntry {
  id: string
  data: string
  hora: string
  usuario: string
  acao: string
  entidade: string
  detalhe: string
  origem: string
}

export const logs: LogEntry[] = [
  { id: "l1", data: "2026-05-29", hora: "09:14", usuario: "Eduardo Tavares", acao: "Login", entidade: "Sessão", detalhe: "Autenticação realizada com sucesso", origem: "192.168.10.24" },
  { id: "l2", data: "2026-05-29", hora: "09:22", usuario: "Eduardo Tavares", acao: "Criação de proposta", entidade: "PRP-2026-0158", detalhe: "Hospital São Lucas — Central de Gases", origem: "192.168.10.24" },
  { id: "l3", data: "2026-05-28", hora: "16:48", usuario: "Ricardo Almeida", acao: "Alteração de preço", entidade: "PRP-2026-0149", detalhe: "Incêndio: R$ 100.440 → R$ 105.000", origem: "201.45.88.12" },
  { id: "l4", data: "2026-05-28", hora: "16:49", usuario: "Ricardo Almeida", acao: "Justificativa registrada", entidade: "PRP-2026-0149", detalhe: "Prazo reduzido e maior risco operacional", origem: "201.45.88.12" },
  { id: "l5", data: "2026-05-23", hora: "11:05", usuario: "Camila Rocha", acao: "Geração de documento", entidade: "PRP-2026-0156", detalhe: "Documento PDF gerado", origem: "187.12.40.90" },
  { id: "l6", data: "2026-05-23", hora: "11:07", usuario: "Camila Rocha", acao: "Envio de e-mail", entidade: "PRP-2026-0156", detalhe: "Enviado para engenharia@atlantico.com", origem: "187.12.40.90" },
  { id: "l7", data: "2026-05-22", hora: "14:31", usuario: "Patrícia Nunes", acao: "Mudança de status", entidade: "PRP-2026-0145", detalhe: "Enviada → Aprovada", origem: "189.66.21.50" },
  { id: "l8", data: "2026-05-20", hora: "10:12", usuario: "Patrícia Nunes", acao: "Mudança de status", entidade: "PRP-2026-0153", detalhe: "Enviada → Aprovada", origem: "189.66.21.50" },
  { id: "l9", data: "2026-05-18", hora: "17:40", usuario: "Ricardo Almeida", acao: "Envio de e-mail", entidade: "PRP-2026-0142", detalhe: "Enviado para compras@saolucas.com.br", origem: "201.45.88.12" },
  { id: "l10", data: "2026-05-09", hora: "08:55", usuario: "Camila Rocha", acao: "Mudança de status", entidade: "PRP-2026-0138", detalhe: "Enviada → Perdida (Preço alto)", origem: "187.12.40.90" },
]

export interface Documento {
  id: string
  nome: string
  tipo: string
  disciplina: string
  status: "Ativo" | "Inativo"
  atualizado: string
  responsavel: string
}

export const documentos: Documento[] = [
  { id: "d1", nome: "Modelo padrão de proposta", tipo: "Modelo", disciplina: "Geral", status: "Ativo", atualizado: "2026-04-30", responsavel: "Ricardo Almeida" },
  { id: "d2", nome: "Escopo padrão — Instalações elétricas", tipo: "Escopo", disciplina: "Instalações elétricas", status: "Ativo", atualizado: "2026-05-12", responsavel: "Eduardo Tavares" },
  { id: "d3", nome: "Condições comerciais padrão", tipo: "Comercial", disciplina: "Geral", status: "Ativo", atualizado: "2026-03-18", responsavel: "Patrícia Nunes" },
  { id: "d4", nome: "Referências para incêndio", tipo: "Referência técnica", disciplina: "Incêndio", status: "Ativo", atualizado: "2026-02-22", responsavel: "Camila Rocha" },
  { id: "d5", nome: "Manual interno de precificação", tipo: "Manual", disciplina: "Geral", status: "Ativo", atualizado: "2026-05-05", responsavel: "Ricardo Almeida" },
  { id: "d6", nome: "Diretrizes de ART e aprovações", tipo: "Diretriz", disciplina: "Geral", status: "Inativo", atualizado: "2025-11-14", responsavel: "Eduardo Tavares" },
]

// Dashboard chart data
export const aprovadasPorMes = [
  { mes: "Dez", quantidade: 5, valor: 420000 },
  { mes: "Jan", quantidade: 7, valor: 560000 },
  { mes: "Fev", quantidade: 6, valor: 510000 },
  { mes: "Mar", quantidade: 9, valor: 720000 },
  { mes: "Abr", quantidade: 8, valor: 680000 },
  { mes: "Mai", quantidade: 11, valor: 940000 },
]

export const conversaoPorOrigem = [
  { origem: "Indicação", taxa: 62, valor: 480000 },
  { origem: "Cliente recorrente", taxa: 71, valor: 920000 },
  { origem: "Parceria arquiteto", taxa: 58, valor: 340000 },
  { origem: "Prospecção ativa", taxa: 39, valor: 610000 },
  { origem: "Site institucional", taxa: 31, valor: 180000 },
]

export const disciplinasMaisVendidas = [
  { disciplina: "Elétricas", quantidade: 38 },
  { disciplina: "Hidráulica", quantidade: 31 },
  { disciplina: "Incêndio", quantidade: 27 },
  { disciplina: "Climatização", quantidade: 22 },
  { disciplina: "SPDA", quantidade: 18 },
  { disciplina: "Estrutura", quantidade: 12 },
]

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

export function formatDate(value: string | null) {
  if (!value) return "—"
  const [y, m, d] = value.split("-")
  return `${d}/${m}/${y}`
}
