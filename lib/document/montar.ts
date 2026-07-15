import { createClient } from "@/lib/supabase/client"
import { getConfigEmpresa } from "@/lib/db/config"
import type { ConfigEmpresa } from "@/lib/db/types"
import type { EmpresaDoc, PropostaDoc } from "./tipos"
import { calcularParcelas, formatarParcelasSalvas, imagemParaDataUrl, corParaHex } from "./util"

// Constrói o EmpresaDoc (branding) a partir da configuração da empresa.
// Ponto único usado tanto pela lista/drawer quanto pelo wizard, garantindo
// que logo, assinatura e cores fiquem idênticos em qualquer origem.
export async function montarEmpresa(config: ConfigEmpresa): Promise<EmpresaDoc> {
  const [logoDataUrl, assinaturaDataUrl] = await Promise.all([
    imagemParaDataUrl(config.logoUrl),
    imagemParaDataUrl(config.assinaturaUrl),
  ])
  return {
    razaoSocial: config.razaoSocial || "IEX Projetos",
    cnpj: config.cnpj,
    endereco: config.endereco,
    telefone: config.telefone,
    email: config.emailComercial,
    textoRodape: config.textoRodape || "Powered by YRM Strategy Lab",
    dadosBancarios: config.dadosBancarios,
    logoDataUrl,
    assinaturaDataUrl,
    corPrimaria: corParaHex(config.corPrimaria),
    corSecundaria: corParaHex(config.corSecundaria),
  }
}

// Monta o documento (PropostaDoc + EmpresaDoc) a partir de uma proposta salva,
// para exportação (Word/PDF) ou envio por e-mail a partir da lista/drawer.
// É a fonte única de verdade: o wizard também gera o documento por aqui após
// salvar, de modo que download da lista e do wizard produzam saída idêntica.
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

  const [{ data: disc }, config, contato] = await Promise.all([
    supabase.from("disciplinas").select("id, escopo_padrao"),
    getConfigEmpresa(),
    // Contato comercial mora no cadastro do cliente, não na proposta.
    p.cliente_id
      ? supabase
          .from("clientes")
          .select("contato")
          .eq("id", p.cliente_id)
          .maybeSingle()
          .then((r) => (r.data?.contato as string) ?? "")
      : Promise.resolve(""),
  ])
  const escopoMap = new Map((disc ?? []).map((d: any) => [d.id, d.escopo_padrao as string[]]))

  // Escopo: usa o snapshot salvo por item (proposta_itens.escopo). Só recorre ao
  // escopo padrão da disciplina se o item não tiver nada salvo (linhas antigas).
  const itens = (p.proposta_itens ?? [])
    .sort((a: any, b: any) => a.ordem - b.ordem)
    .map((i: any) => {
      const salvo = (i.escopo as string[] | null) ?? []
      const escopo = salvo.length ? salvo : i.disciplina_id ? escopoMap.get(i.disciplina_id) ?? [] : []
      return { disciplina: i.disciplina_nome, valor: Number(i.valor_final), escopo }
    })

  const total = Number(p.valor_final)
  const formaPagamento = p.forma_pagamento || "40/40/20"

  // Parcelas: reproduz exatamente as parcelas salvas (descrição/percentual/marco).
  // Fallback para o rateio padrão só quando a proposta não tem parcelas salvas.
  const parcelasSalvas = (p.parcelas as
    | { descricao: string; percentual: number; valor: number; marco?: boolean }[]
    | null) ?? null
  const parcelas =
    parcelasSalvas && parcelasSalvas.length
      ? formatarParcelasSalvas(parcelasSalvas, total)
      : calcularParcelas(formaPagamento, total)

  const doc: PropostaDoc = {
    numero: p.numero,
    cliente: p.cliente_nome ?? "",
    contato,
    empreendimento: p.empreendimento ?? "",
    cidade: p.cidade ?? "",
    uf: p.uf ?? "",
    area: Number(p.area),
    tipo: p.tipo ?? "",
    itens,
    total,
    formaPagamento,
    parcelas,
    prazoExecucao: p.prazo_execucao || "—",
    validade: p.validade || "—",
    premissas: (p.premissas ?? "").split("\n").filter(Boolean),
    exclusoes: (p.exclusoes ?? "").split("\n").filter(Boolean),
    observacoes: p.observacoes ?? "",
    responsavel: p.responsavel_nome ?? "",
  }

  const empresa = await montarEmpresa(config)

  return { doc, empresa }
}
