export const FASES_PROJETO = ["Executivo", "As built"] as const

export function faseProjetoValida(fase: string): boolean {
  return FASES_PROJETO.includes(fase as (typeof FASES_PROJETO)[number])
}
