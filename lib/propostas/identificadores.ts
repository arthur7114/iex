export type ExtensaoDocumento = "pdf" | "docx"

export function formatarCodigoProposta(dataIso: string, sequencial: number): string {
  const dataCompacta = dataIso.replaceAll("-", "")
  return `${dataCompacta}-${String(sequencial).padStart(2, "0")}`
}

export function rotuloVersao(versao: number): string {
  return `V${versao}`
}

export function identificacaoDocumento(numero: string, versao: number): string {
  return versao > 0 ? `${numero} · ${rotuloVersao(versao)}` : numero
}

export function nomeDocumentoVersionado(
  numero: string,
  versao: number,
  extensao: ExtensaoDocumento,
): string {
  return versao > 0
    ? `${numero}-${rotuloVersao(versao)}.${extensao}`
    : `${numero}.${extensao}`
}
