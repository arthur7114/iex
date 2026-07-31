// Identidade de disciplina: lógica pura, sem dependências de DB/cliente,
// isolada aqui para ser testável sem o cliente Supabase.

// slug simples a partir do nome (o id da disciplina é text)
export function slugify(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
}

// Erro tipado: já existe uma disciplina com o mesmo nome (evita duplicatas).
export class DisciplinaDuplicadaError extends Error {
  readonly code = "DISCIPLINA_DUPLICADA"
  constructor(nome: string) {
    super(`Já existe uma disciplina com o nome "${nome}".`)
    this.name = "DisciplinaDuplicadaError"
  }
}

// id determinístico e livre de colisão. Nomes distintos que gerariam o mesmo
// slug — ou nomes só com símbolos, cujo slug seria vazio — recebem sufixo -2, -3…
export function idDisciplinaUnico(nome: string, idsExistentes: Iterable<string>): string {
  const usados = idsExistentes instanceof Set ? idsExistentes : new Set(idsExistentes)
  const base = slugify(nome) || "disciplina"
  if (!usados.has(base)) return base
  let n = 2
  while (usados.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// comparação de nome para detectar duplicata (mesma disciplina)
export const normalizaNome = (nome: string): string => nome.trim().toLowerCase()
