import type { DadosBancarios } from "@/lib/db/types"

// Dados de identidade da empresa usados nos documentos gerados.
export interface EmpresaDoc {
  razaoSocial: string
  cnpj: string
  endereco: string
  telefone: string
  email: string
  textoRodape: string
  dadosBancarios: DadosBancarios | null
  logoDataUrl?: string | null
  assinaturaDataUrl?: string | null
  // Cores de marca já normalizadas para hex de 6 dígitos, sem "#".
  // Nulo => usa o navy institucional padrão.
  corPrimaria?: string | null
  corSecundaria?: string | null
}

// Estrutura do documento de proposta (PRD 008). Compatível com DocumentData
// do componente document-preview.
export interface PropostaDoc {
  numero: string
  cliente: string
  contato: string
  empreendimento: string
  cidade: string
  uf: string
  area: number
  tipo: string
  itens: { disciplina: string; valor: number; escopo?: string[] }[]
  total: number
  formaPagamento: string
  parcelas?: { desc: string; valor: number }[]
  prazoExecucao: string
  validade: string
  premissas: string[]
  exclusoes: string[]
  observacoes: string
  responsavel: string
}

export function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}
