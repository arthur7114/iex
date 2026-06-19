import { createClient } from "@/lib/supabase/client"
import { registrarLogSeguro } from "./logs"

// Colunas da planilha padrão (PRD 003 / Jornada 4).
export const COLUNAS_PADRAO = [
  "cliente",
  "tipo_empreendimento",
  "area_m2",
  "disciplinas",
  "valor_total",
  "data",
  "status",
  "cidade",
  "uf",
  "origem",
  "motivo_perda",
  "observacoes",
  "proposta_referencia",
] as const

export const COLUNAS_OBRIGATORIAS = ["cliente", "valor_total"] as const

const STATUS_VALIDOS = ["Em elaboração", "Enviada", "Aprovada", "Perdida"]

export interface LinhaImport {
  linha: number
  dados: Record<string, string>
  erros: string[]
}

// Valida linhas cruas (já parseadas do CSV) contra a planilha padrão.
export function validarLinhas(rows: Record<string, string>[]): LinhaImport[] {
  return rows.map((dados, i) => {
    const erros: string[] = []
    if (!dados.cliente?.trim()) erros.push("cliente é obrigatório")
    const valor = Number(String(dados.valor_total ?? "").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."))
    if (!dados.valor_total || Number.isNaN(valor)) erros.push("valor_total inválido")
    if (dados.status && !STATUS_VALIDOS.includes(dados.status.trim())) erros.push(`status inválido (use: ${STATUS_VALIDOS.join(", ")})`)
    if (dados.data && Number.isNaN(Date.parse(dados.data))) erros.push("data inválida (use AAAA-MM-DD)")
    return { linha: i + 2, dados, erros } // +2: linha 1 é o cabeçalho
  })
}

function parseValor(v: string): number {
  const n = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."))
  return Number.isNaN(n) ? 0 : n
}

// Importa as linhas válidas: cria/reusa cliente, cria proposta e registra staging.
export async function importarHistorico(
  linhas: LinhaImport[],
  usuarioId: string | null,
): Promise<{ criadas: number; ignoradas: number }> {
  const supabase = createClient()
  const validas = linhas.filter((l) => l.erros.length === 0)
  if (!validas.length) return { criadas: 0, ignoradas: linhas.length }

  // mapa de motivos de perda por nome
  const { data: motivos } = await supabase.from("motivos_perda").select("id,nome")
  const motivoMap = new Map((motivos ?? []).map((m: any) => [m.nome.toLowerCase(), m.id]))

  let criadas = 0
  const loteId = crypto.randomUUID()
  for (const l of validas) {
    const d = l.dados
    const valor = parseValor(d.valor_total)
    const status = STATUS_VALIDOS.includes((d.status ?? "").trim()) ? d.status.trim() : "Aprovada"
    const data = d.data && !Number.isNaN(Date.parse(d.data)) ? d.data.slice(0, 10) : new Date().toISOString().slice(0, 10)
    const disciplinas = (d.disciplinas ?? "").split(/[;,/]/).map((s) => s.trim()).filter(Boolean)

    // cliente: reusa por razão social ou cria
    let clienteId: string | null = null
    const nome = d.cliente.trim()
    const { data: existente } = await supabase.from("clientes").select("id").ilike("razao_social", nome).maybeSingle()
    if (existente) clienteId = existente.id
    else {
      const { data: novo } = await supabase.from("clientes").insert({ razao_social: nome, cidade: d.cidade || null, uf: d.uf || null }).select("id").single()
      clienteId = novo?.id ?? null
    }

    // número
    const ano = new Date(data).getFullYear()
    const numero = `IMP-${ano}-${String(criadas + 1).padStart(4, "0")}-${loteId.slice(0, 4)}`

    const { data: prop, error } = await supabase
      .from("propostas")
      .insert({
        numero,
        cliente_id: clienteId,
        cliente_nome: nome,
        empreendimento: d.observacoes || `Importado — ${d.tipo_empreendimento || "projeto"}`,
        tipo: d.tipo_empreendimento || null,
        cidade: d.cidade || null,
        uf: d.uf || null,
        area: parseValor(d.area_m2),
        disciplinas,
        valor_sugerido: valor,
        valor_final: valor,
        status,
        origem: d.origem || null,
        motivo_perda_id: status === "Perdida" ? motivoMap.get((d.motivo_perda ?? "").toLowerCase()) ?? null : null,
        data_criacao: data,
        data_envio: status !== "Em elaboração" ? data : null,
        observacoes: d.observacoes || null,
      })
      .select("id")
      .single()
    if (error) continue

    await supabase.from("historico_importado").insert({
      lote_id: loteId,
      identificador: numero,
      cliente_nome: nome,
      tipo: d.tipo_empreendimento || null,
      area: parseValor(d.area_m2),
      disciplinas,
      valor_total: valor,
      data,
      status,
      cidade: d.cidade || null,
      uf: d.uf || null,
      origem: d.origem || null,
      motivo_perda: d.motivo_perda || null,
      observacoes: d.observacoes || null,
      proposta_referencia: d.proposta_referencia || null,
      payload_original: d as any,
      importado_por: usuarioId,
    })
    criadas++
  }

  await registrarLogSeguro("Importação de histórico", { entidade: "Histórico", detalhe: `${criadas} propostas importadas` })
  return { criadas, ignoradas: linhas.length - criadas }
}

// CSV modelo para download.
export function csvModelo(): string {
  const exemplo = [
    "Hospital São Lucas;Hospital;3200;Elétrica/Hidráulica/Incêndio;119940;2026-05-18;Aprovada;Recife;PE;Indicação;;Ampliação ala cirúrgica;",
  ]
  return [COLUNAS_PADRAO.join(";"), ...exemplo].join("\n")
}
