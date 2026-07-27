export interface VariavelPrecificacao {
  chave: string
  opcoes: Record<string, number>
}

export function calcularMultiplicador(
  variaveis: VariavelPrecificacao[],
  selecao: Record<string, string>,
): number {
  let impacto = 0
  for (const variavel of variaveis) {
    const opcao = selecao[variavel.chave]
    if (opcao && variavel.opcoes[opcao] !== undefined) {
      impacto += Number(variavel.opcoes[opcao])
    }
  }
  return 1 + impacto
}

export function calcularValorSugerido(
  areaM2: number,
  baseRateM2: number,
  valorMinimo: number,
  multiplicador: number,
): number {
  if (baseRateM2 === 0) return valorMinimo
  return Math.round(Math.max(areaM2 * baseRateM2 * multiplicador, valorMinimo))
}
