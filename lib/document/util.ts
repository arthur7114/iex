// Utilitários de browser para documentos (download, base64, imagem→dataURL).

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(",")[1] ?? "") // remove o prefixo data:...;base64,
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Converte uma URL de imagem (logo/assinatura) em dataURL para embutir no PDF/Word.
export async function imagemParaDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Distribui o total em parcelas conforme a forma de pagamento (PRD 008 / wizard).
export function calcularParcelas(formaPagamento: string, total: number): { desc: string; valor: number }[] {
  if (formaPagamento === "40/40/20") {
    return [
      { desc: "Sinal na aprovação (40%)", valor: total * 0.4 },
      { desc: "Entrega dos executivos (40%)", valor: total * 0.4 },
      { desc: "Aprovações (20%)", valor: total * 0.2 },
    ]
  }
  if (formaPagamento === "50/50") {
    return [
      { desc: "Sinal na aprovação (50%)", valor: total * 0.5 },
      { desc: "Entrega dos executivos (50%)", valor: total * 0.5 },
    ]
  }
  return [{ desc: "Conforme combinado (100%)", valor: total }]
}
