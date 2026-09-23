// Escape mínimo para interpolar texto em HTML de e-mail. Todo conteúdo vindo de
// usuário (corpo, variáveis, campos da assinatura) passa por aqui.
const ENTIDADES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTIDADES[c])
}

// O corpo do e-mail é texto puro: escapa e preserva as quebras de linha.
export function textoParaHtml(texto: string): string {
  return escaparHtml(texto).replace(/\r?\n/g, "<br>")
}
