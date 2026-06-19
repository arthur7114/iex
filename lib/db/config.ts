import { createClient } from "@/lib/supabase/client"
import type { ConfigEmpresa, ConfigPrecificacao, DadosBancarios } from "./types"
import { registrarLogSeguro } from "./logs"

function urlPublica(path: string | null): string | null {
  if (!path) return null
  const supabase = createClient()
  return supabase.storage.from("branding").getPublicUrl(path).data.publicUrl
}

export async function getConfigEmpresa(): Promise<ConfigEmpresa> {
  const supabase = createClient()
  const { data, error } = await supabase.from("config_empresa").select("*").eq("id", 1).maybeSingle()
  if (error) throw error
  return {
    razaoSocial: data?.razao_social ?? "",
    cnpj: data?.cnpj ?? "",
    emailComercial: data?.email_comercial ?? "",
    telefone: data?.telefone ?? "",
    endereco: data?.endereco ?? "",
    textoRodape: data?.texto_rodape ?? "",
    corPrimaria: data?.cor_primaria ?? null,
    corSecundaria: data?.cor_secundaria ?? null,
    logoPath: data?.logo_path ?? null,
    logoUrl: urlPublica(data?.logo_path ?? null),
    assinaturaPath: data?.assinatura_path ?? null,
    assinaturaUrl: urlPublica(data?.assinatura_path ?? null),
    dadosBancarios: (data?.dados_bancarios as DadosBancarios) ?? null,
  }
}

export async function atualizarConfigEmpresa(patch: Partial<ConfigEmpresa>): Promise<void> {
  const supabase = createClient()
  const row: Record<string, unknown> = { id: 1 }
  if (patch.razaoSocial !== undefined) row.razao_social = patch.razaoSocial
  if (patch.cnpj !== undefined) row.cnpj = patch.cnpj
  if (patch.emailComercial !== undefined) row.email_comercial = patch.emailComercial
  if (patch.telefone !== undefined) row.telefone = patch.telefone
  if (patch.endereco !== undefined) row.endereco = patch.endereco
  if (patch.textoRodape !== undefined) row.texto_rodape = patch.textoRodape
  if (patch.corPrimaria !== undefined) row.cor_primaria = patch.corPrimaria
  if (patch.corSecundaria !== undefined) row.cor_secundaria = patch.corSecundaria
  if (patch.logoPath !== undefined) row.logo_path = patch.logoPath
  if (patch.assinaturaPath !== undefined) row.assinatura_path = patch.assinaturaPath
  if (patch.dadosBancarios !== undefined) row.dados_bancarios = patch.dadosBancarios
  const { error } = await supabase.from("config_empresa").upsert(row, { onConflict: "id" })
  if (error) throw error
  await registrarLogSeguro("Configuração da empresa atualizada", { entidade: "Configurações" })
}

export async function getConfigPrecificacao(): Promise<ConfigPrecificacao> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("config_precificacao")
    .select("*")
    .eq("id", 1)
    .maybeSingle()
  if (error) throw error
  return {
    margemAlvo: Number(data?.margem_alvo ?? 0),
    descontoMaxSemAprovacao: Number(data?.desconto_max_sem_aprovacao ?? 0),
    validadePadrao: data?.validade_padrao ?? "",
    exigirJustificativaDesconto: data?.exigir_justificativa_desconto ?? true,
    limiteVariacaoJustificativa: Number(data?.limite_variacao_justificativa ?? 15),
  }
}

export async function atualizarConfigPrecificacao(patch: Partial<ConfigPrecificacao>): Promise<void> {
  const supabase = createClient()
  const row: Record<string, unknown> = { id: 1 }
  if (patch.margemAlvo !== undefined) row.margem_alvo = patch.margemAlvo
  if (patch.descontoMaxSemAprovacao !== undefined)
    row.desconto_max_sem_aprovacao = patch.descontoMaxSemAprovacao
  if (patch.validadePadrao !== undefined) row.validade_padrao = patch.validadePadrao
  if (patch.exigirJustificativaDesconto !== undefined)
    row.exigir_justificativa_desconto = patch.exigirJustificativaDesconto
  if (patch.limiteVariacaoJustificativa !== undefined)
    row.limite_variacao_justificativa = patch.limiteVariacaoJustificativa
  const { error } = await supabase.from("config_precificacao").upsert(row, { onConflict: "id" })
  if (error) throw error
  await registrarLogSeguro("Parâmetros de precificação atualizados", { entidade: "Configurações" })
}
