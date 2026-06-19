import { createClient } from "@/lib/supabase/client"
import { getConfigEmpresa } from "@/lib/db/config"
import type { EmpresaDoc, PropostaDoc } from "./tipos"
import { calcularParcelas, imagemParaDataUrl } from "./util"

// Monta o documento (PropostaDoc + EmpresaDoc) a partir de uma proposta salva,
// para exportação (Word/PDF) ou envio por e-mail a partir da lista/drawer.
export async function montarDocumento(
  propostaId: string,
): Promise<{ doc: PropostaDoc; empresa: EmpresaDoc } | null> {
  const supabase = createClient()
  const { data: p } = await supabase
    .from("propostas")
    .select("*, proposta_itens(*)")
    .eq("id", propostaId)
    .maybeSingle()
  if (!p) return null

  const [{ data: disc }, config] = await Promise.all([
    supabase.from("disciplinas").select("id, escopo_padrao"),
    getConfigEmpresa(),
  ])
  const escopoMap = new Map((disc ?? []).map((d: any) => [d.id, d.escopo_padrao as string[]]))

  const itens = (p.proposta_itens ?? [])
    .sort((a: any, b: any) => a.ordem - b.ordem)
    .map((i: any) => ({
      disciplina: i.disciplina_nome,
      valor: Number(i.valor_final),
      escopo: i.disciplina_id ? escopoMap.get(i.disciplina_id) ?? [] : [],
    }))

  const total = Number(p.valor_final)
  const formaPagamento = p.forma_pagamento || "40/40/20"

  const doc: PropostaDoc = {
    numero: p.numero,
    cliente: p.cliente_nome ?? "",
    contato: "",
    empreendimento: p.empreendimento ?? "",
    cidade: p.cidade ?? "",
    uf: p.uf ?? "",
    area: Number(p.area),
    tipo: p.tipo ?? "",
    itens,
    total,
    formaPagamento,
    parcelas: calcularParcelas(formaPagamento, total),
    prazoExecucao: p.prazo_execucao || "—",
    validade: p.validade || "—",
    premissas: (p.premissas ?? "").split("\n").filter(Boolean),
    exclusoes: (p.exclusoes ?? "").split("\n").filter(Boolean),
    observacoes: p.observacoes ?? "",
    responsavel: p.responsavel_nome ?? "",
  }

  const [logoDataUrl, assinaturaDataUrl] = await Promise.all([
    imagemParaDataUrl(config.logoUrl),
    imagemParaDataUrl(config.assinaturaUrl),
  ])

  const empresa: EmpresaDoc = {
    razaoSocial: config.razaoSocial,
    cnpj: config.cnpj,
    endereco: config.endereco,
    telefone: config.telefone,
    email: config.emailComercial,
    textoRodape: config.textoRodape,
    dadosBancarios: config.dadosBancarios,
    logoDataUrl,
    assinaturaDataUrl,
  }

  return { doc, empresa }
}
