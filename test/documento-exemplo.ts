import type { EmpresaDoc, PropostaDoc } from "@/lib/document/tipos"

// Proposta do Modelo A v2 (total R$ 123.160,00), usada pelos testes de PDF,
// Word e prévia.
export function docExemplo(parcial: Partial<PropostaDoc> = {}): PropostaDoc {
  return {
    numero: "20260928-01",
    versao: 1,
    apresentacao:
      "A IEX Projetos apresenta a proposta técnica e comercial para a elaboração dos projetos executivos de instalações da Clínica Vida Plena. O escopo foi dimensionado a partir do programa de necessidades e do estudo arquitetônico recebidos, com foco em desempenho, segurança e compatibilização entre as disciplinas.",
    cliente: "Grupo Vida Plena Saúde",
    contato: "Dra. Mariana Queiroz",
    empreendimento: "Clínica Vida Plena — Unidade Aldeota",
    cidade: "Fortaleza",
    uf: "CE",
    area: 1850,
    tipo: "Clínica",
    itens: [
      { disciplina: "Instalações elétricas", valor: 30400, escopo: ["Iluminação e tomadas de uso geral e específico.", "Alimentadores de máquinas e climatização.", "Alimentadores e diagramas de quadros elétricos."] },
      { disciplina: "Hidráulica", valor: 23040, escopo: ["Rede de distribuição de água fria.", "Caixas d’água, cisternas e pontos de consumo.", "Registros e dispositivos hidráulicos."] },
      { disciplina: "Prevenção e combate a incêndio", valor: 27500, escopo: ["Rede de detecção e alarme.", "Iluminação de emergência.", "Hidrantes, extintores e rotas de fuga."] },
      { disciplina: "Climatização", valor: 39000, escopo: ["Definição de equipamentos.", "Rede de tubulações frigoríferas.", "Drenos e pontos de alimentação específicos."] },
      { disciplina: "SPDA", valor: 3220, escopo: ["Malha de captação e descidas.", "Aterramentos.", "Equipamentos e conexões."] },
    ],
    total: 123160,
    formaPagamento: "Parcelado por etapa",
    parcelas: [
      { desc: "Assinatura do contrato (30%)", valor: 36948 },
      { desc: "Entrega do anteprojeto (40%)", valor: 49264 },
      { desc: "Entrega do projeto executivo (30%)", valor: 36948 },
    ],
    prazoExecucao: "45 dias úteis",
    validade: "15 dias",
    // Listas enviadas pela IEX (revisão de 01/10/2026).
    premissas: [
      "Projeto executivo detalhado em REVIT, com esquemático das instalações.",
      "Memorial técnico descritivo e lista de materiais por disciplina.",
      "Entrega de ficheiros editáveis em suporte digital, nas versões DWG, PDF e IFC.",
      "Fornecimento de ART (Anotação de Responsabilidade Técnica) junto ao CREA – CE.",
    ],
    exclusoes: [
      "Relatório de estudo do solo para desenvolvimento do projeto de cálculo estrutural.",
      "Projeto luminotécnico para desenvolvimento do projeto de instalações elétricas.",
      "Taxas e os processos de aprovação em órgãos fiscalizadores.",
      "Acompanhamento de obra e execução.",
    ],
    observacoes: "",
    responsavel: "Alderi Sousa",
    assinaturaNome: "Alderi Sousa",
    assinaturaCargo: "Diretor Comercial",
    ...parcial,
  }
}

export function itensExemplo(n: number): PropostaDoc["itens"] {
  return Array.from({ length: n }, (_, i) => ({
    disciplina: `Disciplina ${i + 1}`,
    valor: 1000 * (i + 1),
    escopo: ["Primeiro item do escopo.", "Segundo item do escopo.", "Terceiro item do escopo.", "Quarto item do escopo."],
  }))
}

export function empresaExemplo(parcial: Partial<EmpresaDoc> = {}): EmpresaDoc {
  return {
    razaoSocial: "IEX Projetos",
    cnpj: "45.546.897/0001-91",
    endereco: "Rua Monsenhor Bruno, 1153, Salas 804/806 — Aldeota, Fortaleza/CE",
    telefone: "(85) 99921-8630",
    email: "alderi@iexprojetos.com",
    textoRodape: "",
    dadosBancarios: { banco: "Banco do Brasil", agencia: "0000-0", conta: "00000-0", pix: "45.546.897/0001-91", favorecido: "IEX Projetos" },
    logoDataUrl: null,
    assinaturaDataUrl: null,
    corPrimaria: null,
    corSecundaria: null,
    ...parcial,
  }
}
