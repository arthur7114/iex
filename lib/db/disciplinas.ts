import { createClient } from "@/lib/supabase/client"
import type { Disciplina } from "./types"
import { registrarLogSeguro } from "./logs"
import { idDisciplinaUnico, normalizaNome, DisciplinaDuplicadaError } from "./disciplina-id"

export { idDisciplinaUnico, DisciplinaDuplicadaError } from "./disciplina-id"

interface DisciplinaRow {
  id: string
  nome: string
  titulo_proposta: string | null
  descricao: string | null
  valor_base_m2: number | string
  valor_minimo: number | string
  exige_aprovacao: boolean
  escopo_padrao: string[]
  ordem: number
  ativo: boolean
}

function toDisciplina(r: DisciplinaRow): Disciplina {
  return {
    id: r.id,
    nome: r.nome,
    tituloProposta: r.titulo_proposta ?? r.nome,
    descricao: r.descricao ?? "",
    valorBaseM2: Number(r.valor_base_m2),
    valorMinimo: Number(r.valor_minimo),
    exigeAprovacao: r.exige_aprovacao,
    escopoPadrao: r.escopo_padrao ?? [],
  }
}

export async function listarDisciplinas(incluirInativas = false): Promise<Disciplina[]> {
  const supabase = createClient()
  let query = supabase.from("disciplinas").select("*").order("ordem")
  if (!incluirInativas) query = query.eq("ativo", true)
  const { data, error } = await query
  if (error) throw error
  return (data as DisciplinaRow[]).map(toDisciplina)
}

export async function criarDisciplina(input: Omit<Disciplina, "id"> & { id?: string }): Promise<Disciplina> {
  const supabase = createClient()
  const { data: existentes, error: exErr } = await supabase
    .from("disciplinas")
    .select("id,nome,ordem")
  if (exErr) throw exErr
  const linhas = (existentes ?? []) as { id: string; nome: string; ordem: number | null }[]

  // Nome idêntico ao de uma disciplina já cadastrada → bloqueia com erro tipado
  // (em vez de deixar o INSERT estourar 23505 na chave primária = slug do nome).
  const alvo = normalizaNome(input.nome)
  if (linhas.some((l) => normalizaNome(l.nome) === alvo)) {
    throw new DisciplinaDuplicadaError(input.nome.trim())
  }

  const maxOrdem = linhas.reduce((m, l) => Math.max(m, l.ordem ?? 0), 0)
  const row = {
    id: input.id || idDisciplinaUnico(input.nome, linhas.map((l) => l.id)),
    nome: input.nome,
    titulo_proposta: input.tituloProposta ?? input.nome,
    descricao: input.descricao ?? "",
    valor_base_m2: input.valorBaseM2,
    valor_minimo: input.valorMinimo,
    exige_aprovacao: input.exigeAprovacao,
    escopo_padrao: input.escopoPadrao ?? [],
    ordem: maxOrdem + 1,
  }
  const { data, error } = await supabase.from("disciplinas").insert(row).select("*").single()
  if (error) {
    // Corrida rara: id colidiu apesar da checagem acima → mensagem amigável.
    if (error.code === "23505") throw new DisciplinaDuplicadaError(input.nome.trim())
    throw error
  }
  await registrarLogSeguro("Cadastro de disciplina", { entidade: input.nome, detalhe: "Disciplina criada" })
  return toDisciplina(data as DisciplinaRow)
}

export async function atualizarDisciplina(id: string, input: Partial<Disciplina>): Promise<void> {
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (input.nome !== undefined) patch.nome = input.nome
  if (input.tituloProposta !== undefined) patch.titulo_proposta = input.tituloProposta
  if (input.descricao !== undefined) patch.descricao = input.descricao
  if (input.valorBaseM2 !== undefined) patch.valor_base_m2 = input.valorBaseM2
  if (input.valorMinimo !== undefined) patch.valor_minimo = input.valorMinimo
  if (input.exigeAprovacao !== undefined) patch.exige_aprovacao = input.exigeAprovacao
  if (input.escopoPadrao !== undefined) patch.escopo_padrao = input.escopoPadrao
  const { error } = await supabase.from("disciplinas").update(patch).eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Edição de disciplina", { entidade: input.nome ?? id, entidadeId: id, detalhe: "Disciplina/rate-card atualizado" })
}

export async function definirAtivoDisciplina(id: string, ativo: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("disciplinas").update({ ativo }).eq("id", id)
  if (error) throw error
  await registrarLogSeguro(ativo ? "Disciplina reativada" : "Disciplina desativada", { entidade: id, entidadeId: id })
}
