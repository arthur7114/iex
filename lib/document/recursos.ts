import { ICONES, type IconeId } from "./layout-a"

// Fonte e imagens fixas do documento (public/fonts, public/documento). No
// navegador são buscadas uma vez por sessão; um arquivo que falha vira null e
// o gerador segue sem ele (spec §3). Nos testes, ver test/recursos-documento.ts.

export type PesoFonte = "regular" | "semibold" | "bold" | "extrabold"
export const PESOS: Record<PesoFonte, number> = { regular: 400, semibold: 600, bold: 700, extrabold: 800 }

export interface RecursosDoc {
  // TTF em base64 por peso; null quando algum falhou (o PDF cai para Helvetica).
  fontes: Record<PesoFonte, string> | null
  // Data URLs (PNG; as fotos grandes, socios e metodologia, são JPEG).
  imagens: {
    logoBranco: string | null
    socios: string | null
    mapa: string | null
    metodologia: string | null
    capaRede: string | null
    capaWord: string | null
  }
  icones: Partial<Record<IconeId, string>>
}

export const CAMINHO_FONTE = (peso: PesoFonte) => `/fonts/manrope-${PESOS[peso]}.ttf`
export const CAMINHO_IMAGEM: Record<keyof RecursosDoc["imagens"], string> = {
  logoBranco: "/documento/logo-branco.png",
  socios: "/documento/socios.jpg",
  mapa: "/documento/mapa-brasil.png",
  metodologia: "/documento/metodologia.jpg",
  capaRede: "/documento/capa-rede.png",
  capaWord: "/documento/capa-word.png",
}
export const CAMINHO_ICONE = (id: IconeId) => `/documento/icones/${id}.png`

export const RECURSOS_VAZIOS: RecursosDoc = {
  fontes: null,
  imagens: { logoBranco: null, socios: null, mapa: null, metodologia: null, capaRede: null, capaWord: null },
  icones: {},
}

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

async function buscarBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    return bytesParaBase64(new Uint8Array(await resp.arrayBuffer()))
  } catch {
    return null
  }
}

// MIME pela extensão do arquivo (PNG para ícones e logos, JPEG para as fotos).
export const mimeDaImagem = (caminho: string) => (/\.jpe?g$/i.test(caminho) ? "image/jpeg" : "image/png")

async function buscarImagem(url: string): Promise<string | null> {
  const b64 = await buscarBase64(url)
  return b64 ? `data:${mimeDaImagem(url)};base64,${b64}` : null
}

async function montar(): Promise<RecursosDoc> {
  const pesos = Object.keys(PESOS) as PesoFonte[]
  const chaves = Object.keys(CAMINHO_IMAGEM) as (keyof RecursosDoc["imagens"])[]
  const [fontes, imagens, icones] = await Promise.all([
    Promise.all(pesos.map((p) => buscarBase64(CAMINHO_FONTE(p)))),
    Promise.all(chaves.map((k) => buscarImagem(CAMINHO_IMAGEM[k]))),
    Promise.all(ICONES.map((id) => buscarImagem(CAMINHO_ICONE(id)))),
  ])
  return {
    fontes: fontes.every(Boolean) ? (Object.fromEntries(pesos.map((p, i) => [p, fontes[i]])) as Record<PesoFonte, string>) : null,
    imagens: Object.fromEntries(chaves.map((k, i) => [k, imagens[i]])) as RecursosDoc["imagens"],
    icones: Object.fromEntries(ICONES.flatMap((id, i) => (icones[i] ? [[id, icones[i]]] : []))),
  }
}

let cache: Promise<RecursosDoc> | null = null

// Só guarda em cache um carregamento completo: uma falha de rede passageira
// não deixa a sessão inteira sem fonte ou imagem.
export function carregarRecursos(): Promise<RecursosDoc> {
  if (!cache) {
    cache = montar().then((r) => {
      const completo = r.fontes && Object.values(r.imagens).every(Boolean) && ICONES.every((id) => r.icones[id])
      if (!completo) cache = null
      return r
    })
  }
  return cache
}
