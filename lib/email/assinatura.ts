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

// Mesmo navy institucional dos documentos (lib/document/word.ts). Cores em
// oklch não são convertíveis no servidor (sem canvas) e caem no padrão.
const COR_PADRAO = "#243658"

export function corDaMarca(raw: string | null | undefined): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(raw?.trim() ?? "")
  return m ? `#${m[1].toLowerCase()}` : COR_PADRAO
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
  const texto = [nome, cargo, telefone, email, razao].filter(Boolean).join("\n")

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

  const celulaFoto = foto
    ? `<td valign="top" style="padding-right:12px"><img src="${escaparHtml(src(foto))}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border-radius:32px;border:0"></td>`
    : ""
  const linhas = [
    `<div style="font-weight:bold;font-size:14px;color:#111111">${escaparHtml(nome)}</div>`,
    cargo ? `<div>${escaparHtml(cargo)}</div>` : "",
    telefone ? `<div>${escaparHtml(telefone)}</div>` : "",
    email
      ? `<div><a href="mailto:${escaparHtml(email)}" style="color:${cor};text-decoration:none">${escaparHtml(email)}</a></div>`
      : "",
    logo
      ? `<div style="padding-top:8px"><img src="${escaparHtml(src(logo))}" alt="${escaparHtml(razao ?? "")}" height="32" style="display:block;height:32px;width:auto;border:0"></div>`
      : razao
        ? `<div style="padding-top:4px;color:#666666">${escaparHtml(razao)}</div>`
        : "",
  ].join("")

  const html =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;color:#333333"><tr>` +
    celulaFoto +
    `<td valign="top" style="border-left:3px solid ${cor};padding-left:12px">${linhas}</td>` +
    `</tr></table>`

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
