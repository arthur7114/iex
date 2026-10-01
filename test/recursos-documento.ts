import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { ICONES } from "@/lib/document/layout-a"
import { CAMINHO_FONTE, CAMINHO_ICONE, CAMINHO_IMAGEM, PESOS, type PesoFonte, type RecursosDoc } from "@/lib/document/recursos"

// Lê de public/ os mesmos arquivos que carregarRecursos() busca no navegador.
const publico = fileURLToPath(new URL("../public", import.meta.url))
const base64 = (caminho: string) => readFileSync(publico + caminho).toString("base64")
const png = (caminho: string) => `data:image/png;base64,${base64(caminho)}`

export function recursosDoDisco(o: { fontes: boolean }): RecursosDoc {
  const pesos = Object.keys(PESOS) as PesoFonte[]
  return {
    fontes: o.fontes ? (Object.fromEntries(pesos.map((p) => [p, base64(CAMINHO_FONTE(p))])) as Record<PesoFonte, string>) : null,
    imagens: Object.fromEntries(
      Object.entries(CAMINHO_IMAGEM).map(([k, caminho]) => [k, png(caminho)]),
    ) as RecursosDoc["imagens"],
    icones: Object.fromEntries(ICONES.map((id) => [id, png(CAMINHO_ICONE(id))])),
  }
}
