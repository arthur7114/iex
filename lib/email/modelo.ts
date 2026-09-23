import { brl, type PropostaDoc } from "@/lib/document/tipos"
import { identificacaoDocumento } from "@/lib/propostas/identificadores"

// Modelo padrão do e-mail de envio da proposta (Configurações › E-mail).
// Sintaxe {{variavel}}; desconhecidas ficam literais para o erro ser visível.

export const VARIAVEIS_EMAIL = [
  { token: "cliente", rotulo: "Cliente" },
  { token: "contato", rotulo: "Contato" },
  { token: "empreendimento", rotulo: "Empreendimento" },
  { token: "numero", rotulo: "Nº da proposta" },
  { token: "cidade", rotulo: "Cidade" },
  { token: "uf", rotulo: "UF" },
  { token: "valor_total", rotulo: "Valor total" },
  { token: "validade", rotulo: "Validade" },
  { token: "prazo", rotulo: "Prazo" },
  { token: "empresa", rotulo: "Empresa" },
  { token: "remetente_nome", rotulo: "Seu nome" },
  { token: "remetente_cargo", rotulo: "Seu cargo" },
] as const

export type VariavelEmail = (typeof VARIAVEIS_EMAIL)[number]["token"]
export type ValoresEmail = Partial<Record<VariavelEmail, string>>

export const LIMITE_ASSUNTO = 200
export const LIMITE_CORPO = 5000

// Mesmo texto que o compositor usava fixo no código, agora com variáveis.
export const ASSUNTO_PADRAO = "Proposta comercial {{numero}} — {{empreendimento}}"
export const CORPO_PADRAO = [
  "Prezados,",
  "",
  "Segue em anexo a proposta comercial referente ao empreendimento {{empreendimento}}.",
  "",
  "Permanecemos à disposição para esclarecimentos e ajustes que se façam necessários.",
  "",
  "Atenciosamente,",
  "{{empresa}}",
].join("\n")

// Dados fictícios da prévia nas Configurações.
export const VALORES_EXEMPLO: Record<VariavelEmail, string> = {
  cliente: "Construtora Alfa",
  contato: "Maria Souza",
  empreendimento: "Residencial Aurora",
  numero: "20260923-01 · V2",
  cidade: "Recife",
  uf: "PE",
  valor_total: brl(48500),
  validade: "30 dias",
  prazo: "60 dias",
  empresa: "IEX Engenharia",
  remetente_nome: "Seu nome",
  remetente_cargo: "Seu cargo",
}

const CONHECIDAS = new Set<string>(VARIAVEIS_EMAIL.map((v) => v.token))
const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g

export function modeloEfetivo(m: { assunto: string | null; corpo: string | null }): {
  assunto: string
  corpo: string
} {
  return {
    assunto: m.assunto?.trim() ? m.assunto : ASSUNTO_PADRAO,
    corpo: m.corpo?.trim() ? m.corpo : CORPO_PADRAO,
  }
}

export function renderizarModelo(texto: string, valores: ValoresEmail): string {
  return texto.replace(TOKEN, (original, nome: string) =>
    CONHECIDAS.has(nome) ? (valores[nome as VariavelEmail] ?? "") : original,
  )
}

export function tokensDesconhecidos(texto: string): string[] {
  const achados = new Set<string>()
  for (const m of texto.matchAll(TOKEN)) {
    if (!CONHECIDAS.has(m[1])) achados.add(m[1])
  }
  return [...achados]
}

export function valoresDaProposta(
  doc: PropostaDoc,
  empresa: { razaoSocial: string },
  remetente: { nome: string; cargo: string | null },
): ValoresEmail {
  return {
    cliente: doc.cliente,
    contato: doc.contato,
    empreendimento: doc.empreendimento,
    numero: identificacaoDocumento(doc.numero, doc.versao),
    cidade: doc.cidade,
    uf: doc.uf,
    valor_total: brl(doc.total),
    validade: doc.validade,
    prazo: doc.prazoExecucao,
    empresa: empresa.razaoSocial,
    remetente_nome: remetente.nome,
    remetente_cargo: remetente.cargo ?? "",
  }
}

// Fallback do compositor quando o servidor não responde: texto padrão com os
// dados que o cliente já tem. A assinatura é aplicada no envio de qualquer forma.
export function rascunhoPadrao(doc: PropostaDoc, razaoSocial: string): { assunto: string; corpo: string } {
  const valores = valoresDaProposta(doc, { razaoSocial }, { nome: "", cargo: null })
  return { assunto: renderizarModelo(ASSUNTO_PADRAO, valores), corpo: renderizarModelo(CORPO_PADRAO, valores) }
}
