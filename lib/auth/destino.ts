// Origem fictícia usada só para validar caminhos quando não há uma origem real
// à mão (componentes de cliente renderizados também no servidor). O host em si
// não importa: o que interessa é o destino continuar na MESMA origem depois de
// resolvido.
const ORIGEM_NEUTRA = "https://destino.invalido"

// Normaliza um destino de redirecionamento vindo de fora (querystring de um
// link de e-mail, `?redirect=` da tela de login) para um caminho interno.
//
// Comparar prefixos não basta. O parser de URL converte barras invertidas em
// barras normais, então "/\evil.com" vira "//evil.com" e aponta para outro
// host — passando por um teste de startsWith("//"). Resolver contra a origem e
// conferir o host fecha a família inteira de variações.
//
// Devolve sempre um caminho começando por "/": "/" quando o destino é externo,
// malformado ou ausente.
export function destinoInternoSeguro(
  next: string | null | undefined,
  origem: string = ORIGEM_NEUTRA,
): string {
  if (!next || !next.startsWith("/")) return "/"
  let destino: URL
  try {
    destino = new URL(next, origem)
  } catch {
    return "/"
  }
  if (destino.origin !== origem) return "/"
  return `${destino.pathname}${destino.search}${destino.hash}`
}
