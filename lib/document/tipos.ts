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
  versao: number
  apresentacao: string
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
  // Autor da proposta: alimenta a auditoria e o filtro da lista. Não é
  // necessariamente quem assina o documento.
  responsavel: string
  // Identidade impressa sob a assinatura, congelada no snapshot da versão.
  // Ausentes nas propostas anteriores ao campo: nesse caso assina o autor, com
  // o cargo padrão.
  assinaturaNome?: string
  assinaturaCargo?: string
}

// Cargo impresso na assinatura quando a proposta não traz um cargo próprio
// (PRD 001: assinatura comercial padrão da IEX).
export const CARGO_SIGNATARIO_PADRAO = "Diretor Comercial"

// Resolve quem assina o documento. Ponto único da regra de fallback, para que
// preview, Word e PDF nunca divirjam: assinatura explícita > autor da proposta
// > razão social; cargo explícito > cargo padrão.
export function assinaturaDoDocumento(
  doc: Pick<PropostaDoc, "responsavel" | "assinaturaNome" | "assinaturaCargo">,
  razaoSocial?: string,
): { nome: string; cargo: string } {
  return {
    nome: doc.assinaturaNome?.trim() || doc.responsavel?.trim() || razaoSocial?.trim() || "",
    cargo: doc.assinaturaCargo?.trim() || CARGO_SIGNATARIO_PADRAO,
  }
}

export interface VersaoSnapshot {
  schemaVersion: 2
  doc: PropostaDoc
  empresa: EmpresaDoc
}

export function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}
