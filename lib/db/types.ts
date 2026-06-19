// Tipos de domínio (reaproveita os tipos do mock como contrato da UI) + tipos novos.
export type {
  StatusProposta,
  MotivoPerda,
  Disciplina,
  Cliente,
  ItemProposta,
  Proposta,
  LogEntry,
  Documento,
} from "@/lib/mock-data"

// Variável de complexidade (config editável, vinda de variaveis_complexidade)
export interface VariavelComplexidade {
  id: string
  chave: string
  nome: string
  descricao: string | null
  opcoes: Record<string, number> // opcao -> impacto
  ordem: number
  ativo: boolean
}

// Item de lista de referência (origens, perfis, tipos, motivos, formas)
export interface OpcaoRef {
  id: string
  nome: string
  ordem: number
  ativo: boolean
}

export interface DadosBancarios {
  banco?: string
  agencia?: string
  conta?: string
  pix?: string
  favorecido?: string
}

export interface ConfigEmpresa {
  razaoSocial: string
  cnpj: string
  emailComercial: string
  telefone: string
  endereco: string
  textoRodape: string
  corPrimaria: string | null
  corSecundaria: string | null
  logoPath: string | null
  logoUrl: string | null
  assinaturaPath: string | null
  assinaturaUrl: string | null
  dadosBancarios: DadosBancarios | null
}

export interface ConfigPrecificacao {
  margemAlvo: number
  descontoMaxSemAprovacao: number
  validadePadrao: string
  exigirJustificativaDesconto: boolean
  limiteVariacaoJustificativa: number
}

export interface UsuarioAtual {
  id: string // usuarios.id
  authUserId: string
  nome: string
  email: string | null
  funcao: string
}

// Tabelas de referência (categoria -> nome da tabela)
export const TABELAS_REF = {
  origem_cliente: "origens_cliente",
  perfil_cliente: "perfis_cliente",
  tipo_empreendimento: "tipos_empreendimento",
  motivo_perda: "motivos_perda",
  forma_pagamento: "formas_pagamento",
} as const

export type CategoriaRef = keyof typeof TABELAS_REF
