import { createClient } from "@/lib/supabase/client"
import { registrarLogSeguro } from "./logs"
import { listarDisciplinas } from "./disciplinas"
import {
  criarPropostaImportada,
  PropostaDuplicadaError,
  type ItemImportado,
} from "./propostas"
import type { StatusProposta } from "./types"

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

const STATUS_VALIDOS: StatusProposta[] = ["Em elaboração", "Enviada", "Aprovada", "Perdida"]

export type StatusLinha = "valida" | "duplicada" | "erro"

export interface LinhaImport {
  linha: number
  dados: Record<string, string>
  erros: string[]
  duplicada: boolean
  // Chave de deduplicação (cliente + empreendimento + valor + data, normalizados).
  chave: string
  // Valores derivados para a pré-visualização.
  valor: number
  disciplinasReconhecidas: string[]
  disciplinasDesconhecidas: string[]
}

export function statusDaLinha(l: LinhaImport): StatusLinha {
  if (l.erros.length > 0) return "erro"
  if (l.duplicada) return "duplicada"
  return "valida"
}

export interface ResultadoImportacao {
  total: number
  criadas: number
  ignoradas: number // duplicatas (não recriadas)
  comErro: number
  erros: { linha: number; cliente: string; motivo: string }[]
}

function parseValor(v: string | undefined): number {
  const n = Number(
    String(v ?? "")
      .replace(/[^\d.,-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  )
  return Number.isNaN(n) ? 0 : n
}

function normalizar(s: string): string {
  return s.trim().toLowerCase()
}

// Nome canônico para casar disciplina do CSV com o cadastro (ignora caixa/acentos).
function slugNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function separarDisciplinas(v: string | undefined): string[] {
  return (v ?? "")
    .split(/[;,/|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function empreendimentoDe(d: Record<string, string>): string {
  const obs = (d.observacoes ?? "").trim()
  if (obs) return obs
  const tipo = (d.tipo_empreendimento ?? "").trim() || "projeto"
  return `Importado — ${tipo}`
}

function dataDe(d: Record<string, string>): string {
  return d.data && !Number.isNaN(Date.parse(d.data))
    ? d.data.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
}

// Chave estável de deduplicação (mesma tupla usada pelo índice do banco — 0112).
function chaveDedup(cliente: string, empreendimento: string, valor: number, data: string): string {
  return [normalizar(cliente), normalizar(empreendimento), Math.round(valor), data].join("|")
}

// Valida as linhas cruas (já parseadas do CSV) e enriquece com deduplicação e
// reconhecimento de disciplinas. Faz uma consulta ao banco para saber quais
// propostas importadas já existem — assim conseguimos avisar ANTES de confirmar
// que a reimportação do mesmo arquivo não vai criar duplicatas.
export async function analisarLinhas(rows: Record<string, string>[]): Promise<LinhaImport[]> {
  const supabase = createClient()

  // Disciplinas cadastradas (para reconhecer os nomes vindos do CSV).
  let nomesDisc = new Set<string>()
  try {
    const disc = await listarDisciplinas(true)
    nomesDisc = new Set(disc.map((d) => slugNome(d.nome)))
  } catch {
    // Sem disciplinas não impede a análise; apenas não marcamos reconhecidas.
  }

  // Chaves de propostas importadas já existentes no banco.
  const existentes = new Set<string>()
  try {
    const { data } = await supabase
      .from("propostas")
      .select("cliente_nome,empreendimento,valor_final,data_criacao")
      .ilike("numero", "IMP-%")
    for (const p of (data ?? []) as {
      cliente_nome: string | null
      empreendimento: string | null
      valor_final: number | string | null
      data_criacao: string | null
    }[]) {
      existentes.add(
        chaveDedup(
          p.cliente_nome ?? "",
          p.empreendimento ?? "",
          Number(p.valor_final ?? 0),
          (p.data_criacao ?? "").slice(0, 10),
        ),
      )
    }
  } catch {
    // Se a consulta falhar, seguimos sem marcar duplicatas do banco (o índice
    // único da migration 0112 ainda protege contra criação duplicada).
  }

  const vistasNoArquivo = new Set<string>()

  return rows.map((dados, i) => {
    const erros: string[] = []
    if (!dados.cliente?.trim()) erros.push("cliente é obrigatório")

    const temValor = !!(dados.valor_total && dados.valor_total.trim())
    const valor = parseValor(dados.valor_total)
    if (!temValor) erros.push("valor_total é obrigatório")
    else if (valor <= 0) erros.push("valor_total inválido")

    if (dados.status?.trim() && !STATUS_VALIDOS.includes(dados.status.trim() as StatusProposta)) {
      erros.push(`status inválido (use: ${STATUS_VALIDOS.join(", ")})`)
    }
    if (dados.data?.trim() && Number.isNaN(Date.parse(dados.data))) {
      erros.push("data inválida (use AAAA-MM-DD)")
    }

    const listadas = separarDisciplinas(dados.disciplinas)
    const disciplinasReconhecidas: string[] = []
    const disciplinasDesconhecidas: string[] = []
    for (const nome of listadas) {
      if (nomesDisc.has(slugNome(nome))) disciplinasReconhecidas.push(nome)
      else disciplinasDesconhecidas.push(nome)
    }

    const cliente = (dados.cliente ?? "").trim()
    const chave = erros.length
      ? ""
      : chaveDedup(cliente, empreendimentoDe(dados), valor, dataDe(dados))

    let duplicada = false
    if (!erros.length) {
      if (existentes.has(chave) || vistasNoArquivo.has(chave)) duplicada = true
      vistasNoArquivo.add(chave)
    }

    return {
      linha: i + 2, // +2: a linha 1 é o cabeçalho
      dados,
      erros,
      duplicada,
      chave,
      valor,
      disciplinasReconhecidas,
      disciplinasDesconhecidas,
    }
  })
}

// Compat: validação síncrona simples (sem deduplicação). Mantida para chamadas
// que só precisam dos erros de formato.
export function validarLinhas(rows: Record<string, string>[]): LinhaImport[] {
  const vistas = new Set<string>()
  return rows.map((dados, i) => {
    const erros: string[] = []
    if (!dados.cliente?.trim()) erros.push("cliente é obrigatório")
    const temValor = !!(dados.valor_total && dados.valor_total.trim())
    const valor = parseValor(dados.valor_total)
    if (!temValor) erros.push("valor_total é obrigatório")
    else if (valor <= 0) erros.push("valor_total inválido")
    if (dados.status?.trim() && !STATUS_VALIDOS.includes(dados.status.trim() as StatusProposta)) {
      erros.push(`status inválido (use: ${STATUS_VALIDOS.join(", ")})`)
    }
    if (dados.data?.trim() && Number.isNaN(Date.parse(dados.data))) {
      erros.push("data inválida (use AAAA-MM-DD)")
    }
    const chave = erros.length
      ? ""
      : chaveDedup((dados.cliente ?? "").trim(), empreendimentoDe(dados), valor, dataDe(dados))
    let duplicada = false
    if (!erros.length) {
      if (vistas.has(chave)) duplicada = true
      vistas.add(chave)
    }
    return {
      linha: i + 2,
      dados,
      erros,
      duplicada,
      chave,
      valor,
      disciplinasReconhecidas: separarDisciplinas(dados.disciplinas),
      disciplinasDesconhecidas: [],
    }
  })
}

// Distribui o valor total entre as disciplinas informadas, ponderando pelo
// valor_base_m2 do cadastro quando disponível (senão, divide igualmente). O
// resto vai para o último item para que a soma bata exatamente com o total.
function montarItens(
  disciplinasCsv: string[],
  valorTotal: number,
  cadastro: Map<string, { id: string; nome: string; valorBaseM2: number; escopoPadrao: string[] }>,
): ItemImportado[] {
  if (!disciplinasCsv.length) {
    return [
      {
        disciplinaId: null,
        disciplina: "Projeto (importado)",
        valorSugerido: Math.round(valorTotal),
        valorFinal: Math.round(valorTotal),
        escopo: [],
      },
    ]
  }

  const resolvidas = disciplinasCsv.map((nome) => {
    const d = cadastro.get(slugNome(nome))
    return {
      disciplinaId: d?.id ?? null,
      disciplina: d?.nome ?? nome,
      peso: d && d.valorBaseM2 > 0 ? d.valorBaseM2 : 1,
      escopo: d?.escopoPadrao ?? [],
    }
  })

  const somaPesos = resolvidas.reduce((a, r) => a + r.peso, 0) || resolvidas.length
  let alocado = 0
  const total = Math.round(valorTotal)
  return resolvidas.map((r, idx) => {
    const ultimo = idx === resolvidas.length - 1
    const valor = ultimo ? total - alocado : Math.round((total * r.peso) / somaPesos)
    alocado += valor
    return {
      disciplinaId: r.disciplinaId,
      disciplina: r.disciplina,
      valorSugerido: valor,
      valorFinal: valor,
      escopo: r.escopo,
    }
  })
}

// Importa as linhas: cria/reusa cliente, cria a proposta COMPLETA (via
// criarPropostaImportada — com itens/escopo e valores), registra o staging e
// pula duplicatas. Chama onProgress(feitas, total) para progresso real.
export async function importarHistorico(
  linhas: LinhaImport[],
  usuarioId: string | null,
  onProgress?: (feitas: number, total: number) => void,
): Promise<ResultadoImportacao> {
  const supabase = createClient()

  const importaveis = linhas.filter((l) => l.erros.length === 0 && !l.duplicada)
  const errosPrevios = linhas.filter((l) => l.erros.length > 0)
  const duplicadasPrevias = linhas.filter((l) => l.erros.length === 0 && l.duplicada)

  const resultado: ResultadoImportacao = {
    total: linhas.length,
    criadas: 0,
    ignoradas: duplicadasPrevias.length,
    comErro: 0,
    erros: errosPrevios.map((l) => ({
      linha: l.linha,
      cliente: (l.dados.cliente ?? "").trim(),
      motivo: l.erros.join("; "),
    })),
  }

  if (!importaveis.length) {
    onProgress?.(0, 0)
    await registrarLogSeguro("Importação de histórico", {
      entidade: "Histórico",
      detalhe: `0 criadas, ${resultado.ignoradas} ignoradas, ${resultado.comErro} com erro`,
    })
    return resultado
  }

  // Cadastro de disciplinas (nome canônico -> dados) para montar os itens.
  const cadastro = new Map<
    string,
    { id: string; nome: string; valorBaseM2: number; escopoPadrao: string[] }
  >()
  try {
    for (const d of await listarDisciplinas(true)) {
      cadastro.set(slugNome(d.nome), {
        id: d.id,
        nome: d.nome,
        valorBaseM2: d.valorBaseM2,
        escopoPadrao: d.escopoPadrao,
      })
    }
  } catch {
    // Segue sem cadastro; itens ficam com disciplina_id nulo mas com nome/valor.
  }

  // Motivos de perda por nome.
  const { data: motivos } = await supabase.from("motivos_perda").select("id,nome")
  const motivoMap = new Map(
    ((motivos ?? []) as { id: string; nome: string }[]).map((m) => [m.nome.toLowerCase(), m.id]),
  )

  const loteId = crypto.randomUUID()
  const total = importaveis.length
  let feitas = 0
  onProgress?.(0, total)

  for (const l of importaveis) {
    const d = l.dados
    const nome = d.cliente.trim()
    const valor = l.valor
    const status = (STATUS_VALIDOS.includes((d.status ?? "").trim() as StatusProposta)
      ? (d.status ?? "").trim()
      : "Aprovada") as StatusProposta
    const data = dataDe(d)
    const empreendimento = empreendimentoDe(d)
    const disciplinasCsv = separarDisciplinas(d.disciplinas)

    try {
      // Cliente: reusa por razão social ou cria.
      let clienteId: string | null = null
      const { data: existente } = await supabase
        .from("clientes")
        .select("id")
        .ilike("razao_social", nome)
        .maybeSingle()
      if (existente) clienteId = existente.id
      else {
        const { data: novo } = await supabase
          .from("clientes")
          .insert({ razao_social: nome, cidade: d.cidade || null, uf: d.uf || null })
          .select("id")
          .single()
        clienteId = novo?.id ?? null
      }

      const ano = new Date(data).getFullYear()
      const numero = `IMP-${ano}-${String(resultado.criadas + 1).padStart(4, "0")}-${loteId.slice(0, 4)}`
      const itens = montarItens(disciplinasCsv, valor, cadastro)
      const valorTotalItens = itens.reduce((a, it) => a + it.valorFinal, 0)

      await criarPropostaImportada({
        numero,
        clienteId,
        clienteNome: nome,
        empreendimento,
        tipo: d.tipo_empreendimento || null,
        cidade: d.cidade || null,
        uf: d.uf || null,
        area: parseValor(d.area_m2),
        disciplinas: itens.map((it) => it.disciplina),
        itens,
        valorSugerido: valorTotalItens,
        valorFinal: valorTotalItens,
        status,
        origem: d.origem || null,
        motivoPerdaId:
          status === "Perdida" ? motivoMap.get((d.motivo_perda ?? "").toLowerCase()) ?? null : null,
        dataCriacao: data,
        dataEnvio: status !== "Em elaboração" ? data : null,
        observacoes: d.observacoes || null,
        responsavelId: usuarioId,
      })

      await supabase.from("historico_importado").insert({
        lote_id: loteId,
        identificador: numero,
        cliente_nome: nome,
        tipo: d.tipo_empreendimento || null,
        area: parseValor(d.area_m2),
        disciplinas: disciplinasCsv,
        valor_total: valor,
        data,
        status,
        cidade: d.cidade || null,
        uf: d.uf || null,
        origem: d.origem || null,
        motivo_perda: d.motivo_perda || null,
        observacoes: d.observacoes || null,
        proposta_referencia: d.proposta_referencia || null,
        payload_original: d as Record<string, string>,
        importado_por: usuarioId,
      })

      resultado.criadas++
    } catch (e) {
      if (e instanceof PropostaDuplicadaError) {
        resultado.ignoradas++
      } else {
        resultado.comErro++
        resultado.erros.push({
          linha: l.linha,
          cliente: nome,
          motivo: e instanceof Error ? e.message : "Falha ao criar a proposta",
        })
      }
    } finally {
      feitas++
      onProgress?.(feitas, total)
    }
  }

  await registrarLogSeguro("Importação de histórico", {
    entidade: "Histórico",
    detalhe: `${resultado.criadas} criadas, ${resultado.ignoradas} ignoradas, ${resultado.comErro} com erro`,
  })
  return resultado
}

// Gera um CSV com as linhas que falharam (para o usuário corrigir e reimportar).
export function csvRelatorioErros(erros: ResultadoImportacao["erros"]): string {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const linhas = erros.map((e) => [String(e.linha), escape(e.cliente), escape(e.motivo)].join(";"))
  return ["linha;cliente;motivo", ...linhas].join("\n")
}

// CSV modelo para download.
export function csvModelo(): string {
  const exemplo = [
    "Hospital São Lucas;Hospital;3200;Elétrica/Hidráulica/Incêndio;119940;2026-05-18;Aprovada;Recife;PE;Indicação;;Ampliação ala cirúrgica;",
  ]
  return [COLUNAS_PADRAO.join(";"), ...exemplo].join("\n")
}
