// Gera as imagens do documento da proposta (public/documento) a partir de
// scripts/documento/fontes. Só roda em desenvolvimento, com Google Chrome (e o
// sips do macOS para os JPEG). Uso: node scripts/documento/rasterizar.mjs
// (CHROME=/caminho para outro binário).
//
// Os anexos por e-mail passam por uma Server Action, então as fotos grandes
// (metodologia, sócios) ficam em JPEG para o PDF e o Word caberem em 1 MB.
// - metodologia.jpg: gerada aqui, achatada sobre branco (os cantos
//   arredondados ficam sobre a página branca, não precisam de transparência).
// - socios.jpg: cópia convertida da foto original dos sócios (fundo sólido
//   #172b4d, igual ao do painel), já versionada em public/documento; não sai
//   deste script. Para regerar: sips -s format jpeg -s formatOptions 72 <foto>.png --out socios.jpg
import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"

const raiz = resolve(import.meta.dirname, "../..")
const fontes = join(raiz, "scripts/documento/fontes")
const destino = join(raiz, "public/documento")
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const tmp = mkdtempSync(join(tmpdir(), "iex-documento-"))
const arquivo = (nome) => `file://${join(fontes, nome)}`

function render(saida, corpo, largura, altura, { fundo = "transparent", jpeg = false } = {}) {
  const png = jpeg ? join(tmp, `${basename(saida)}.png`) : join(destino, saida)
  const html = join(tmp, `${basename(saida)}.html`)
  writeFileSync(html, `<!doctype html><html><head><style>html,body{margin:0;background:${fundo}}img{display:block}</style></head><body>${corpo}</body></html>`)
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
    fundo === "transparent" ? "--default-background-color=00000000" : "--default-background-color=ffffffff",
    `--window-size=${largura},${altura}`, `--screenshot=${png}`, `file://${html}`,
  ], { stdio: "ignore" })
  if (jpeg) execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "85", png, "--out", join(destino, saida)], { stdio: "ignore" })
  console.log(`ok  ${saida}`)
}

// Logo branco (proporção 145,83 × 113,78).
render("logo-branco.png", `<img src="${arquivo("logo-branco.svg")}" style="width:640px">`, 640, 500)
// Mapa do Brasil (proporção 273,2 × 275,44).
render("mapa-brasil.png", `<img src="${arquivo("mapa-brasil.svg")}" style="width:800px">`, 800, 807)
// Desenho técnico da capa (viewBox 600 × 420).
render("capa-rede.png", `<img src="${arquivo("capa-rede.svg")}" style="width:1500px">`, 1500, 1050)
// Painel da metodologia: 174 × 56 mm a 10 px/mm, cantos de 3 mm e degradê já aplicados,
// sobre fundo branco e salvo em JPEG.
render("metodologia.jpg", `<div style="width:1740px;height:560px;border-radius:30px;overflow:hidden;position:relative;background:#172b4d url(${arquivo("predio-blueprint.png")}) center/cover no-repeat"><div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,28,51,.88),rgba(15,28,51,0) 70%)"></div></div>`, 1740, 560, { fundo: "#ffffff", jpeg: true })
// Capa do Word: A4 a 150 dpi, sem texto (o texto vai editável por cima).
render("capa-word.png", `<svg width="1240" height="1754" viewBox="0 0 210 297" xmlns="http://www.w3.org/2000/svg"><rect width="210" height="297" fill="#fff"/><polygon points="0,0 210,0 210,184.14 0,231.66" fill="#0f1c33"/><image href="${arquivo("capa-rede.svg")}" x="70" y="26" width="150" height="105"/><polygon points="0,231.66 210,184.14 210,188.89 0,236.41" fill="#c09a55"/></svg>`, 1240, 1754, { fundo: "#ffffff" })
// Ícones a 96 px.
for (const svg of readdirSync(join(fontes, "icones")).filter((f) => f.endsWith(".svg"))) {
  render(`icones/${svg.replace(".svg", ".png")}`, `<img src="${arquivo(`icones/${svg}`)}" style="width:96px">`, 96, 96)
}
