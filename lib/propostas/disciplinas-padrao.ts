import type { Disciplina, TipoEmpreendimento } from "@/lib/db/types"

export function disciplinasPadraoDoTipo(
  nome: string,
  tipos: TipoEmpreendimento[],
  disciplinasAtivas: Disciplina[],
): string[] {
  const ids = tipos.find((tipo) => tipo.nome === nome)?.disciplinasPadrao ?? []
  return disciplinasAtivas.filter((disciplina) => ids.includes(disciplina.id)).map((disciplina) => disciplina.id)
}

export function trocarDisciplinasPadrao(selecionadas: string[], automaticas: string[], novoPadrao: string[]) {
  const manuais = selecionadas.filter((id) => !automaticas.includes(id))
  const adicionadas = novoPadrao.filter((id) => !manuais.includes(id))
  return { selecionadas: [...adicionadas, ...manuais], automaticas: adicionadas }
}
