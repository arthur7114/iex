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

// Formata parcelas já salvas na proposta (descrição + percentual + marco) no mesmo
// padrão usado pelo wizard, de modo que documento gerado pela lista/drawer e pelo
// wizard fiquem idênticos. Usa o valor persistido (mesma regra de arredondamento).
export function formatarParcelasSalvas(
  parcelas: { descricao: string; percentual: number; valor: number; marco?: boolean }[],
  total: number,
): { desc: string; valor: number }[] {
  return parcelas.map((p) => {
    const pct = Number(p.percentual) || 0
    const valor = p.valor != null ? Number(p.valor) : Math.round((total * pct) / 100)
    return {
      desc: p.marco ? `${p.descricao} (marco — ${pct}%)` : `${p.descricao} (${pct}%)`,
      valor,
    }
  })
}

// Converte qualquer cor CSS (hex ou oklch(...)) em hex de 6 dígitos sem "#".
// Usa o canvas do browser para parsear formatos modernos com segurança.
// Retorna null quando não há valor ou o ambiente não é o browser.
export function corParaHex(css: string | null | undefined): string | null {
  if (!css || typeof document === "undefined") return null
  const raw = css.trim()
  const hexDireto = /^#?([0-9a-fA-F]{6})$/.exec(raw)
  if (hexDireto) return hexDireto[1].toLowerCase()
  const hexCurto = /^#?([0-9a-fA-F]{3})$/.exec(raw)
  if (hexCurto) {
    return hexCurto[1]
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()
  }
  try {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = "#000000"
    ctx.fillStyle = raw
    // Se o browser não reconheceu a cor, fillStyle continua no fallback.
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")
  } catch {
    return null
  }
}

// Converte hex de 6 dígitos (sem "#") em tupla RGB para o jsPDF.
export function hexParaRgb(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Decodifica um data URL de imagem em bytes + tipo, para embutir no .docx (docx/ImageRun).
export function dataUrlParaImagem(
  dataUrl: string | null | undefined,
): { data: Uint8Array; tipo: "png" | "jpg" | "gif" | "bmp" } | null {
  if (!dataUrl || typeof atob === "undefined") return null
  const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  const ext = m[1].toLowerCase()
  const tipo = ext === "jpeg" || ext === "jpg" ? "jpg" : (ext as "png" | "gif" | "bmp")
  try {
    const bin = atob(m[2])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { data: bytes, tipo }
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
