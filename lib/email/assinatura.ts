import { escaparHtml, textoParaHtml } from "./html"

// Assinatura do e-mail de quem envia a proposta. Pura: recebe caminhos no
// storage e um resolvedor de `src` — `cid:` no envio real, URL pública na prévia.

export type ModoAssinatura = "html" | "imagem"

export interface DadosAssinatura {
  modo: ModoAssinatura | null
  nome: string
  cargo: string | null
  telefone: string | null
  email: string | null
  fotoPath: string | null
  imagemPath: string | null
}

export interface MarcaEmpresa {
  razaoSocial: string
  endereco: string | null
  logoPath: string | null
  corPrimaria: string | null
}

export interface ImagemAssinatura {
  cid: string
  path: string
}

export interface AssinaturaMontada {
  html: string
  texto: string
  imagens: ImagemAssinatura[]
}

export type ResolverImagem = (img: ImagemAssinatura) => string

export const srcInline: ResolverImagem = (img) => `cid:${img.cid}`

// Mesmo navy institucional dos documentos (lib/document/word.ts).
const COR_PADRAO = "#243658"

// As Configurações salvam a cor como hex ou oklch(...). No servidor não há
// canvas (lib/document/util.ts::corParaHex), então oklch é convertido na mão:
// OKLCH → OKLab → sRGB linear → sRGB (fórmulas de Björn Ottosson).
function oklchParaHex(raw: string): string | null {
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/[^)]*)?\)$/i.exec(raw)
  if (!m) return null
  const L = m[2] ? Number(m[1]) / 100 : Number(m[1])
  const C = Number(m[3])
  const h = (Number(m[4]) * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ]
  return (
    "#" +
    lin
      .map((x) => {
        const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
        return Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, "0")
      })
      .join("")
  )
}

export function corDaMarca(raw: string | null | undefined): string {
  const t = raw?.trim() ?? ""
  const hex = /^#?([0-9a-fA-F]{6})$/.exec(t)
  if (hex) return `#${hex[1].toLowerCase()}`
  return oklchParaHex(t) ?? COR_PADRAO
}

function limpo(s: string | null | undefined): string | null {
  const t = s?.trim()
  return t ? t : null
}

export function montarAssinatura(d: DadosAssinatura, marca: MarcaEmpresa, src: ResolverImagem): AssinaturaMontada {
  const nome = d.nome.trim()
  const cargo = limpo(d.cargo)
  const telefone = limpo(d.telefone)
  const email = limpo(d.email)
  const razao = limpo(marca.razaoSocial)
  const endereco = limpo(marca.endereco)
  const texto = [nome, cargo, telefone, email, razao, endereco].filter(Boolean).join("\n")

  if (d.modo === "imagem" && d.imagemPath) {
    const img = { cid: "assinatura-imagem", path: d.imagemPath }
    return {
      html: `<p style="margin:16px 0 0"><img src="${escaparHtml(src(img))}" alt="${escaparHtml(nome)}" style="display:block;max-width:600px;height:auto;border:0"></p>`,
      texto,
      imagens: [img],
    }
  }

  const cor = corDaMarca(marca.corPrimaria)
  const imagens: ImagemAssinatura[] = []
  const foto = d.fotoPath ? { cid: "assinatura-foto", path: d.fotoPath } : null
  const logo = marca.logoPath ? { cid: "assinatura-logo", path: marca.logoPath } : null
  if (foto) imagens.push(foto)
  if (logo) imagens.push(logo)

  // Layout em tabelas (Outlook ignora flex/grid): foto | dados | logo, e um
  // rodapé com a empresa sob uma linha na cor da marca.
  const celulaFoto = foto
    ? `<td valign="middle" width="96" style="padding-right:16px"><img src="${escaparHtml(src(foto))}" width="80" height="80" alt="" style="display:block;width:80px;height:80px;border-radius:40px;border:0"></td>`
    : ""
  const contato = (rotulo: string, conteudo: string) =>
    `<div style="padding-top:2px"><span style="color:${cor};font-weight:bold">${rotulo}</span>&nbsp;&nbsp;${conteudo}</div>`
  const dados = [
    `<div style="font-weight:bold;font-size:17px;line-height:1.3;color:#111111">${escaparHtml(nome)}</div>`,
    cargo ? `<div style="font-weight:bold;font-size:13px;color:${cor};padding-bottom:6px">${escaparHtml(cargo)}</div>` : "",
    telefone ? contato("T", escaparHtml(telefone)) : "",
    email
      ? contato(
          "E",
          `<a href="mailto:${escaparHtml(email)}" style="color:#333333;text-decoration:none">${escaparHtml(email)}</a>`,
        )
      : "",
  ].join("")
  const celulaLogo = logo
    ? `<td valign="middle" style="border-left:1px solid #dddddd;padding-left:16px"><img src="${escaparHtml(src(logo))}" alt="${escaparHtml(razao ?? "")}" height="44" style="display:block;height:44px;width:auto;border:0"></td>`
    : ""
  const colunas = 1 + (foto ? 1 : 0) + (logo ? 1 : 0)
  const rodape = [razao, endereco].filter(Boolean).map((t) => escaparHtml(t as string)).join(" · ")

  const html =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#333333">` +
    // width=100% na coluna de dados: a sobra criada pelo rodapé vai para ela,
    // não para o vão entre foto e nome.
    `<tr>${celulaFoto}<td valign="middle" width="100%" style="padding-right:16px">${dados}</td>${celulaLogo}</tr>` +
    (rodape
      ? `<tr><td colspan="${colunas}" style="padding-top:12px"><div style="border-top:2px solid ${cor};padding-top:8px;font-size:11px;color:#777777">${rodape}</div></td></tr>`
      : "") +
    `</table>`

  return { html, texto, imagens }
}

// Corpo final nas duas partes do multipart. O corpo nunca é tratado como HTML.
export function montarCorpoEmail(corpo: string, assinatura: AssinaturaMontada): { texto: string; html: string } {
  return {
    texto: `${corpo}\n\n--\n${assinatura.texto}`,
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222">${textoParaHtml(corpo)}</div>` +
      assinatura.html,
  }
}
