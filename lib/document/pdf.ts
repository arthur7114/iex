import jsPDF from "jspdf"
import { identificacaoDocumento } from "@/lib/propostas/identificadores"
import {
  APRESENTACAO_PADRAO, EMPRESA_PADRAO, INSTITUCIONAL, PALETA, RODAPE_PADRAO, contatoRodape, dataPorExtenso,
  fichaEmpreendimento, formatarArea, formatarPercentual, iconeDisciplina, linhasBancarias, mesAno, paginar,
  percentual, rotuloParcela, subtituloCapa, tituloCapa, type BlocoPaginavel,
} from "./layout-a"
import { carregarRecursos, type PesoFonte, type RecursosDoc } from "./recursos"
import { assinaturaDoDocumento, brl, type EmpresaDoc, type PropostaDoc } from "./tipos"
import { hexParaRgb } from "./util"

// PDF da proposta no layout "Modelo A v2" (spec 2026-10-01). Medidas em mm,
// as mesmas do modelo aprovado. A capa é desenhada direto; as páginas
// internas são uma lista de blocos com altura conhecida, distribuída por
// paginar() — por isso cabeçalho, rodapé e "NN / TT" saem certos em
// propostas de qualquer tamanho.

const W = 210
const M = 18
const LARG = W - 2 * M
const TOPO = 27
const BASE = 276
const PT = 0.3528 // mm por ponto tipográfico

type RGB = [number, number, number]
const rgb = (hex: string): RGB => hexParaRgb(hex) ?? [0, 0, 0]
const pad = (n: number) => String(n).padStart(2, "0")
const passo = (tam: number, lh: number) => tam * PT * lh

interface Ctx {
  pdf: jsPDF
  rec: RecursosDoc
  doc: PropostaDoc
  empresa: EmpresaDoc
  usar: (peso: PesoFonte) => void
}

interface Bloco extends BlocoPaginavel {
  secao: string
  desenhar: (y: number) => void
}

interface OpcoesTexto {
  peso?: PesoFonte
  tam: number
  cor: string
  align?: "left" | "right" | "center"
  espaco?: number // letter-spacing em em
  lh?: number
}

function registrarFontes(pdf: jsPDF, fontes: RecursosDoc["fontes"]): (peso: PesoFonte) => void {
  const helvetica = (peso: PesoFonte) => pdf.setFont("helvetica", peso === "regular" ? "normal" : "bold")
  if (!fontes) return helvetica
  try {
    for (const peso of Object.keys(fontes) as PesoFonte[]) {
      const arquivo = `manrope-${peso}.ttf`
      pdf.addFileToVFS(arquivo, fontes[peso])
      pdf.addFont(arquivo, `Manrope-${peso}`, "normal")
    }
    return (peso) => pdf.setFont(`Manrope-${peso}`, "normal")
  } catch {
    return helvetica
  }
}

function fonte(c: Ctx, peso: PesoFonte, tam: number) {
  c.usar(peso)
  c.pdf.setFontSize(tam)
}

function escrever(c: Ctx, s: string | string[], x: number, y: number, o: OpcoesTexto) {
  fonte(c, o.peso ?? "regular", o.tam)
  c.pdf.setTextColor(...rgb(o.cor))
  c.pdf.text(s, x, y, {
    align: o.align ?? "left",
    charSpace: o.espaco ? o.tam * PT * o.espaco : 0,
    lineHeightFactor: o.lh ?? 1.15,
  })
}

function quebrar(c: Ctx, s: string, largura: number, tam: number, peso: PesoFonte = "regular"): string[] {
  fonte(c, peso, tam)
  return c.pdf.splitTextToSize(s ?? "", largura) as string[]
}

function largura(c: Ctx, s: string, tam: number, peso: PesoFonte = "regular", espaco = 0): number {
  fonte(c, peso, tam)
  return c.pdf.getTextWidth(s) + (espaco ? tam * PT * espaco * s.length : 0)
}

const formatoImagem = (url: string) => (/^data:image\/jpe?g/i.test(url) ? "JPEG" : "PNG")

function proporcao(c: Ctx, url: string | null | undefined): number | null {
  if (!url) return null
  try {
    const p = c.pdf.getImageProperties(url)
    return p.height / p.width
  } catch {
    return null
  }
}

// Imagem com altura pela proporção quando `h` não vem. Imagem ausente ou
// inválida não impede o PDF.
function imagem(c: Ctx, url: string | null | undefined, alias: string, x: number, y: number, w: number, h?: number) {
  if (!url) return
  const alt = h ?? (() => { const p = proporcao(c, url); return p ? w * p : null })()
  if (!alt) return
  try {
    c.pdf.addImage(url, formatoImagem(url), x, y, w, alt, alias, "FAST")
  } catch {
    /* segue sem a imagem */
  }
}

function retangulo(c: Ctx, x: number, y: number, w: number, h: number, o: { fundo?: string; borda?: string; raio?: number }) {
  const { pdf } = c
  if (o.fundo) pdf.setFillColor(...rgb(o.fundo))
  if (o.borda) {
    pdf.setDrawColor(...rgb(o.borda))
    pdf.setLineWidth(0.25)
  }
  const estilo = o.fundo && o.borda ? "FD" : o.fundo ? "F" : "S"
  if (o.raio) pdf.roundedRect(x, y, w, h, o.raio, o.raio, estilo)
  else pdf.rect(x, y, w, h, estilo)
}

function linhaH(c: Ctx, x1: number, x2: number, y: number, cor: string = PALETA.linha, tracejada = false) {
  c.pdf.setDrawColor(...rgb(cor))
  c.pdf.setLineWidth(0.25)
  if (tracejada) c.pdf.setLineDashPattern([0.8, 0.8], 0)
  c.pdf.line(x1, y, x2, y)
  if (tracejada) c.pdf.setLineDashPattern([], 0)
}

// ── Capa ────────────────────────────────────────────────────────────────

function desenharCapa(c: Ctx) {
  const { pdf, doc } = c
  const hoje = new Date()
  // Bloco navy diagonal (0,0)-(210,0)-(210,184,14)-(0,231,66) e faixa dourada.
  pdf.setFillColor(...rgb(PALETA.navyCapa))
  pdf.lines([[W, 0], [0, 184.14], [-W, 47.52]], 0, 0, [1, 1], "F", true)
  imagem(c, c.rec.imagens.capaRede, "capa-rede", 70, 26, 150)
  pdf.setFillColor(...rgb(PALETA.dourado))
  pdf.lines([[W, -47.52], [0, 4.75], [-W, 47.52]], 0, 231.66, [1, 1], "F", true)
  imagem(c, c.rec.imagens.logoBranco, "logo-branco", M, 18, 32)

  const chip = `Proposta ${mesAno(hoje)}`.toUpperCase()
  const largChip = largura(c, chip, 7.5, "regular", 0.18) + 7
  pdf.setDrawColor(...rgb(PALETA.bordaChip))
  pdf.setLineWidth(0.25)
  pdf.roundedRect(W - M - largChip, 20, largChip, 7, 3.5, 3.5, "S")
  escrever(c, chip, W - M - largChip + 3.5, 24.7, { tam: 7.5, cor: PALETA.branco, espaco: 0.18 })

  escrever(c, "PROPOSTA TÉCNICA E COMERCIAL", M, 111, { peso: "bold", tam: 9, cor: PALETA.dourado, espaco: 0.2 })
  let titulo = tituloCapa(doc.empreendimento).flatMap((l) => quebrar(c, l, 125, 38, "extrabold"))
  if (titulo.length > 3) titulo = [...titulo.slice(0, 2), `${titulo[2]}…`]
  escrever(c, titulo, M, 127.5, { peso: "extrabold", tam: 38, cor: PALETA.branco, lh: 1.02 })
  const ySub = 127.5 + (titulo.length - 1) * passo(38, 1.02) + 10
  escrever(c, quebrar(c, subtituloCapa(doc.itens), 125, 10.5), M, ySub, { tam: 10.5, cor: PALETA.suaveNoNavy, lh: 1.6 })

  const colunas: [string, string, string][] = [
    ["Cliente", doc.cliente, doc.contato ? `A/C ${doc.contato}` : ""],
    ["Proposta", identificacaoDocumento(doc.numero, doc.versao), ""],
    ["Emitida em", dataPorExtenso(hoje), doc.validade ? `Validade: ${doc.validade}` : ""],
  ]
  const larguras = [63.2, 48.6, 48.6]
  let x = M
  colunas.forEach(([rotulo, valor, sub], i) => {
    retangulo(c, x, 265, 0.7, 14, { fundo: PALETA.dourado })
    escrever(c, rotulo.toUpperCase(), x + 4, 268.5, { tam: 7.5, cor: PALETA.cinza, espaco: 0.12 })
    escrever(c, quebrar(c, valor || "—", larguras[i] - 6, 10.5, "bold")[0] ?? "", x + 4, 274, { peso: "bold", tam: 10.5, cor: PALETA.tinta })
    if (sub) escrever(c, quebrar(c, sub, larguras[i] - 6, 8.5)[0] ?? "", x + 4, 278.5, { tam: 8.5, cor: PALETA.cinza })
    x += larguras[i] + 6
  })
}

// ── Moldura das páginas internas ───────────────────────────────────────

function desenharMoldura(c: Ctx, secao: string, n: number, total: number) {
  const { doc, empresa } = c
  retangulo(c, 0, 0, W, 15, { fundo: PALETA.navy })
  imagem(c, c.rec.imagens.logoBranco, "logo-branco", M, 2.75, 12.2)
  const rotulo = secao.toUpperCase()
  escrever(c, rotulo, W / 2 - largura(c, rotulo, 7.5, "regular", 0.16) / 2, 9.3, { tam: 7.5, cor: PALETA.branco, espaco: 0.16 })
  escrever(c, identificacaoDocumento(doc.numero, doc.versao), W - M, 9.3, { tam: 7.5, cor: PALETA.branco, align: "right" })
  linhaH(c, M, W - M, 283)
  escrever(c, quebrar(c, contatoRodape(empresa), 140, 7)[0] ?? "", M, 287.5, { tam: 7, cor: PALETA.cinza })
  escrever(c, empresa.textoRodape || RODAPE_PADRAO, M, 291.5, { tam: 6.5, cor: PALETA.cinzaClaro })
  escrever(c, `${pad(n)} / ${pad(total)}`, W - M, 287.5, { tam: 7, cor: PALETA.cinza, align: "right" })
}

function tituloSecao(c: Ctx, num: number, titulo: string, x: number, y: number, larg: number) {
  escrever(c, pad(num), x, y + 6.5, { tam: 10, cor: PALETA.dourado })
  escrever(c, titulo, x + 9, y + 6.5, { peso: "extrabold", tam: 17, cor: PALETA.navy })
  const fim = x + 9 + largura(c, titulo, 17, "extrabold") + 4
  if (fim < x + larg) linhaH(c, fim, x + larg, y + 4.6)
}

function secaoBloco(c: Ctx, secao: string, num: number, titulo: string, quebraAntes = false): Bloco {
  return { secao, altura: 13, quebraAntes, manterComProximo: true, desenhar: (y) => tituloSecao(c, num, titulo, M, y, LARG) }
}

function blocosTexto(c: Ctx, secao: string, texto: string, tam: number): Bloco[] {
  const lh = 1.65
  const linhas = quebrar(c, texto, LARG, tam)
  const porBloco = Math.max(1, Math.floor((BASE - TOPO - 20) / passo(tam, lh)))
  const blocos: Bloco[] = []
  for (let i = 0; i < linhas.length; i += porBloco) {
    const parte = linhas.slice(i, i + porBloco)
    const ultimo = i + porBloco >= linhas.length
    blocos.push({
      secao,
      altura: parte.length * passo(tam, lh) + (ultimo ? 6 : 0),
      desenhar: (y) => escrever(c, parte, M, y + tam * PT, { tam, cor: PALETA.texto, lh }),
    })
  }
  return blocos
}

// ── Quem somos e apresentação ──────────────────────────────────────────

// Painel navy com foto dos sócios, mapa e números (revisão da IEX: sem título
// nem resumo dentro do painel; o texto institucional vem logo abaixo).
function blocoQuemSomos(c: Ctx, secao: string): Bloco {
  const ALT = 100
  return {
    secao,
    altura: ALT + 7,
    desenhar: (y) => {
      const { imagens } = c.rec
      retangulo(c, M, y, LARG, ALT, { fundo: PALETA.painel, raio: 3 })
      // Foto com o fundo da mesma cor do painel: encostada no pé, sem máscara.
      const propSocios = proporcao(c, imagens.socios)
      if (propSocios) imagem(c, imagens.socios, "socios", M + 4, y + ALT - 86, 86 / propSocios, 86)
      retangulo(c, M + 8, y + ALT - 17, 46, 11, { fundo: PALETA.navyCapa, raio: 1.5 })
      escrever(c, INSTITUCIONAL.socios, M + 11, y + ALT - 12.4, { peso: "bold", tam: 8, cor: PALETA.branco })
      escrever(c, INSTITUCIONAL.sociosLegenda, M + 11, y + ALT - 8.4, { tam: 7, cor: PALETA.suaveNoPainel })
      imagem(c, imagens.mapa, "mapa", M + 74, y + 18, 62)
      INSTITUCIONAL.numeros.forEach((n, i) => {
        const x = M + LARG - 36
        const t = y + 14 + i * 27
        retangulo(c, x, t, 0.7, 21, { fundo: PALETA.dourado })
        if (n.prefixo) escrever(c, n.prefixo, x + 3, t + 2.8, { tam: 7.5, cor: PALETA.suaveNoPainel })
        escrever(c, n.valor, x + 3, t + 11.8, { peso: "extrabold", tam: 24, cor: PALETA.branco })
        escrever(c, quebrar(c, n.rotulo, 26, 7.8, "semibold"), x + 3, t + 16, { peso: "semibold", tam: 7.8, cor: PALETA.azulClaro, lh: 1.3 })
      })
    },
  }
}

function blocoFicha(c: Ctx, secao: string): Bloco | null {
  const campos = fichaEmpreendimento(c.doc)
  if (!campos.length) return null
  const linhas = Math.ceil(campos.length / 3)
  const ALT = 15
  const COL = LARG / 3
  return {
    secao,
    altura: linhas * ALT + 9,
    desenhar: (y) => {
      retangulo(c, M, y, LARG, linhas * ALT, { borda: PALETA.linha, raio: 3 })
      for (let l = 1; l < linhas; l++) linhaH(c, M, M + LARG, y + l * ALT)
      campos.forEach(([rotulo, valor], i) => {
        const col = i % 3
        const x = M + col * COL
        const yy = y + Math.floor(i / 3) * ALT
        if (col > 0) {
          c.pdf.setDrawColor(...rgb(PALETA.linha))
          c.pdf.line(x, yy, x, yy + ALT)
        }
        escrever(c, rotulo.toUpperCase(), x + 5, yy + 6, { tam: 7, cor: PALETA.cinza, espaco: 0.14 })
        escrever(c, quebrar(c, valor, COL - 9, 10, "bold")[0] ?? "", x + 5, yy + 11.5, { peso: "bold", tam: 10, cor: PALETA.tinta })
      })
    },
  }
}

// ── Metodologia ────────────────────────────────────────────────────────

function blocosMetodologia(c: Ctx, num: () => number): Bloco[] {
  const secao = "Metodologia"
  const blocos: Bloco[] = [secaoBloco(c, secao, num(), "Como trabalhamos", true)]

  blocos.push({
    secao,
    altura: 65,
    desenhar: (y) => {
      imagem(c, c.rec.imagens.metodologia, "metodologia", M, y, LARG, 56)
      escrever(c, "ENGENHARIA INTEGRADA", M + 6, y + 44, { tam: 8, cor: PALETA.branco, espaco: 0.14 })
      escrever(c, INSTITUCIONAL.metodologiaChamada, M + 6, y + 50.5, { peso: "bold", tam: 13, cor: PALETA.branco })
    },
  })

  const larg3 = (LARG - 8) / 3
  const textos = INSTITUCIONAL.diferenciais.map((d) => quebrar(c, d.texto, larg3 - 10, 8.4))
  const altD = 25.5 + Math.max(...textos.map((t) => t.length)) * passo(8.4, 1.55) + 4
  blocos.push({
    secao,
    altura: altD + 9,
    desenhar: (y) => {
      INSTITUCIONAL.diferenciais.forEach((d, i) => {
        const x = M + i * (larg3 + 4)
        retangulo(c, x, y, larg3, altD, { borda: PALETA.linha, raio: 3 })
        retangulo(c, x + 5, y + 5, 9, 9, { fundo: PALETA.faixa, raio: 2 })
        imagem(c, c.rec.icones[d.icone], `icone-${d.icone}`, x + 6.8, y + 6.8, 5.4, 5.4)
        escrever(c, d.titulo, x + 5, y + 20, { peso: "bold", tam: 10.5, cor: PALETA.navy })
        escrever(c, textos[i], x + 5, y + 25.5, { tam: 8.4, cor: PALETA.textoCard, lh: 1.55 })
      })
    },
  })

  blocos.push(secaoBloco(c, secao, num(), "Nossas especialidades"))
  const larg4 = (LARG - 9) / 4
  const cartoes = INSTITUCIONAL.especialidades.map((e) => ({
    titulo: quebrar(c, e.titulo, larg4 - 9, 9.5, "bold"),
    itens: e.itens.map((it) => quebrar(c, it, larg4 - 9, 7.8)),
  }))
  const altE = Math.max(
    ...cartoes.map((k) => 7 + k.titulo.length * passo(9.5, 1.25) + 1.5 + k.itens.flat().length * passo(7.8, 1.55) + 4),
  )
  blocos.push({
    secao,
    altura: altE + 9,
    desenhar: (y) => {
      cartoes.forEach((k, i) => {
        const x = M + i * (larg4 + 3)
        retangulo(c, x, y, larg4, altE, { fundo: PALETA.faixa, raio: 3 })
        retangulo(c, x + 1.5, y, larg4 - 3, 0.7, { fundo: PALETA.dourado })
        escrever(c, k.titulo, x + 4.5, y + 7, { peso: "bold", tam: 9.5, cor: PALETA.navy, lh: 1.25 })
        let ly = y + 7 + k.titulo.length * passo(9.5, 1.25) + 1.5
        for (const linhas of k.itens) {
          escrever(c, linhas, x + 4.5, ly, { tam: 7.8, cor: PALETA.textoCard, lh: 1.55 })
          ly += linhas.length * passo(7.8, 1.55)
        }
      })
    },
  })
  return blocos
}

// ── Escopo e investimento ──────────────────────────────────────────────

// Sem quebra antes: o escopo continua na página da apresentação (revisão da
// IEX) e paginar() leva o resto para a página seguinte.
//
// Uma disciplina que não cabe numa página é partida por linha de escopo. Cada
// fatia tem o próprio orçamento de linhas: desconta o cabeçalho que ela mesma
// desenha (título; nas fatias seguintes, "<nome> (continuação)") e, na primeira
// disciplina, os 13 mm do título da seção, que viaja junto com a primeira fatia.
// Assim nenhuma fatia passa de BASE - TOPO e o título da seção nunca fica sozinho.
const MAX_LINHAS_TITULO = 4

function blocosEscopo(c: Ctx, num: () => number): Bloco[] {
  const secao = "Escopo e investimento"
  const blocos: Bloco[] = [secaoBloco(c, secao, num(), "Escopo por disciplina")]
  const lh = passo(9, 1.6)
  const util = BASE - TOPO
  const cabecalho = (texto: string, larg: number) => {
    const linhas = quebrar(c, texto, larg, 11.5, "bold")
    return linhas.length > MAX_LINHAS_TITULO ? [...linhas.slice(0, MAX_LINHAS_TITULO - 1), `${linhas[MAX_LINHAS_TITULO - 1]}…`] : linhas
  }

  c.doc.itens.forEach((item, indice) => {
    const valor = brl(item.valor)
    const larguraTexto = M + LARG - (largura(c, valor, 11, "bold") + 5) - 34
    const titulo = cabecalho(item.disciplina, larguraTexto)
    const continuacao = cabecalho(`${item.disciplina} (continuação)`, larguraTexto)
    const altCabecalho = (linhas: string[]) => linhas.length * passo(11.5, 1.2)
    const linhas = (item.escopo ?? []).flatMap((e) =>
      quebrar(c, e, larguraTexto - 4, 9).map((l, i) => ({ l, marcador: i === 0 })),
    )

    // Linhas que cabem numa página nova depois do cabeçalho (11 = 2 x 5,5 de respiro).
    const orcamento = (cab: string[], extra: number) =>
      Math.max(1, Math.floor((util - extra - 11 - 4 - altCabecalho(cab)) / lh))

    let resto = linhas
    let primeira = true
    do {
      const cab = primeira ? titulo : continuacao
      const parte = resto.slice(0, orcamento(cab, primeira && indice === 0 ? 13 : 0))
      resto = resto.slice(parte.length)
      const eInicial = primeira
      const altCab = altCabecalho(cab)
      const altura = 5.5 + Math.max(11, 4 + altCab + parte.length * lh) + 5.5
      blocos.push({
        secao,
        altura,
        desenhar: (y) => {
          const y0 = y + 5.5
          if (eInicial) {
            const id = iconeDisciplina(item.disciplina)
            retangulo(c, M, y0, 11, 11, { fundo: PALETA.faixa, raio: 2.5 })
            imagem(c, c.rec.icones[id], `icone-${id}`, M + 2.9, y0 + 2.9, 5.2, 5.2)
            escrever(c, valor, M + LARG, y0 + 4.2, { peso: "bold", tam: 11, cor: PALETA.tinta, align: "right" })
          }
          escrever(c, cab, 34, y0 + 4.2, { peso: "bold", tam: 11.5, cor: PALETA.navy, lh: 1.2 })
          let ly = y0 + 4.2 + altCab + 1.5
          for (const { l, marcador } of parte) {
            if (marcador) retangulo(c, 34, ly - 1.3, 1.6, 0.25, { fundo: PALETA.dourado })
            escrever(c, l, 38, ly, { tam: 9, cor: PALETA.textoCard })
            ly += lh
          }
          linhaH(c, M, M + LARG, y + altura)
        },
      })
      primeira = false
    } while (resto.length)
  })

  blocos.push({
    secao,
    altura: 30,
    desenhar: (y) => {
      const yy = y + 8
      retangulo(c, M, yy, LARG, 22, { fundo: PALETA.navy, raio: 3 })
      escrever(c, "INVESTIMENTO TOTAL", M + 8, yy + 9, { peso: "bold", tam: 8, cor: PALETA.dourado, espaco: 0.2 })
      const legenda = c.doc.area > 0 ? `Valor global para ${formatarArea(c.doc.area)}` : "Valor global da proposta"
      escrever(c, legenda, M + 8, yy + 14.5, { tam: 9, cor: PALETA.suaveNoNavy })
      escrever(c, brl(c.doc.total), M + LARG - 8, yy + 14.2, { peso: "extrabold", tam: 24, cor: PALETA.branco, align: "right" })
    },
  })
  return blocos
}

// ── Condições comerciais ───────────────────────────────────────────────

interface LinhaCartao {
  pill?: string
  rotulo: string[]
  valor: string[]
  tamValor: number
  altura: number
}

function blocosCondicoes(c: Ctx, num: () => number): Bloco[] {
  const secao = "Condições comerciais"
  const { doc, empresa } = c
  const blocos: Bloco[] = [secaoBloco(c, secao, num(), "Condições comerciais", true)]
  const COL = (LARG - 8) / 2

  const linha = (rotulo: string, valores: string[], o: { pill?: string; tamValor?: number; largValor: number }): LinhaCartao => {
    const tamValor = o.tamValor ?? 9.5
    const valor = valores.flatMap((v) => quebrar(c, v, o.largValor, tamValor, "bold"))
    const rot = quebrar(c, rotulo, COL - 12 - o.largValor - 3 - (o.pill ? 12 : 0), 9.5)
    const altura = Math.max(rot.length * passo(9.5, 1.35), valor.length * passo(tamValor, 1.35)) + 3.4
    return { pill: o.pill, rotulo: rot, valor, tamValor, altura }
  }

  const pagamento = (doc.parcelas ?? []).length
    ? (doc.parcelas ?? []).map((p) =>
        linha(rotuloParcela(p.desc), [brl(p.valor)], { pill: formatarPercentual(percentual(p.valor, doc.total)), largValor: 28 }),
      )
    : [linha(doc.formaPagamento || "A combinar", [], { largValor: 0 })]
  const banco = linhasBancarias(empresa.dadosBancarios)
  const prazo = [
    linha("Prazo de execução", [doc.prazoExecucao || "—"], { largValor: 36 }),
    linha("Validade da proposta", [doc.validade || "—"], { largValor: 36 }),
    ...(banco.length ? [linha("Dados bancários", banco, { largValor: 46, tamValor: 8 })] : []),
  ]
  const altCartao = (ls: LinhaCartao[]) => 14 + ls.reduce((s, l) => s + l.altura, 0) + 2
  const ALT = Math.max(altCartao(pagamento), altCartao(prazo))

  const cartao = (x: number, y: number, titulo: string, ls: LinhaCartao[]) => {
    retangulo(c, x, y, COL, ALT, { borda: PALETA.linha, raio: 3 })
    escrever(c, quebrar(c, titulo.toUpperCase(), COL - 22, 8, "bold")[0] ?? "", x + 6, y + 9, { peso: "bold", tam: 8, cor: PALETA.cinza, espaco: 0.12 })
    let ly = y + 14
    ls.forEach((l, i) => {
      const base = ly + 9.5 * PT * 0.9 + 0.6
      let xr = x + 6
      if (l.pill) {
        retangulo(c, xr, ly, 10.5, 4.6, { fundo: PALETA.douradoSuave, raio: 2.3 })
        escrever(c, l.pill, xr + 5.25, ly + 3.3, { peso: "bold", tam: 7, cor: PALETA.dourado, align: "center" })
        xr += 12
      }
      escrever(c, l.rotulo, xr, base, { tam: 9.5, cor: PALETA.tinta, lh: 1.35 })
      if (l.valor.length) escrever(c, l.valor, x + COL - 6, base, { peso: "bold", tam: l.tamValor, cor: PALETA.tinta, align: "right", lh: 1.35 })
      ly += l.altura
      if (i < ls.length - 1) linhaH(c, x + 6, x + COL - 6, ly - 1.2, PALETA.linha, true)
    })
  }
  blocos.push({
    secao,
    altura: ALT + 9,
    desenhar: (y) => {
      cartao(M, y, `Pagamento — ${doc.formaPagamento || "a combinar"}`, pagamento)
      cartao(M + COL + 8, y, "Prazo e validade", prazo)
    },
  })

  // Incluso / Não incluso lado a lado (uma coluna some quando vazia).
  const colunas = [
    { titulo: "Incluso", itens: doc.premissas.filter((s) => s?.trim()), tipo: "ok" as const },
    { titulo: "Não incluso", itens: doc.exclusoes.filter((s) => s?.trim()), tipo: "nao" as const },
  ].filter((col) => col.itens.length)
  if (colunas.length) {
    const larg = colunas.length === 2 ? COL : LARG
    const numeros = colunas.map(() => num())
    blocos.push({
      secao,
      altura: 13,
      manterComProximo: true,
      desenhar: (y) => colunas.forEach((col, i) => tituloSecao(c, numeros[i], col.titulo, M + i * (COL + 8), y, larg)),
    })
    const quebradas = colunas.map((col) => col.itens.map((it) => quebrar(c, it, larg - 6, 9.5)))
    const total = Math.max(...quebradas.map((q) => q.length))
    for (let i = 0; i < total; i++) {
      const alt = Math.max(...quebradas.map((q) => q[i]?.length ?? 0)) * passo(9.5, 1.45) + 3.6
      blocos.push({
        secao,
        altura: alt + (i === total - 1 ? 9 : 0),
        desenhar: (y) =>
          quebradas.forEach((q, k) => {
            const linhas = q[i]
            if (!linhas) return
            const x = M + k * (COL + 8)
            const base = y + 1.8 + 9.5 * PT
            if (colunas[k].tipo === "ok") {
              c.pdf.setDrawColor(...rgb(PALETA.verde))
              c.pdf.setLineWidth(0.45)
              c.pdf.lines([[0.9, 0.9], [1.8, -2]], x, base - 1.3)
            } else {
              escrever(c, "—", x, base, { peso: "bold", tam: 9.5, cor: PALETA.vermelho })
            }
            escrever(c, linhas, x + 6, base, { tam: 9.5, cor: PALETA.texto, lh: 1.45 })
            if (i < q.length - 1) linhaH(c, x, x + larg, y + alt)
          }),
      })
    }
  }

  if (doc.observacoes?.trim()) {
    blocos.push(secaoBloco(c, secao, num(), "Observações"), ...blocosTexto(c, secao, doc.observacoes, 9.5))
  }

  const assinatura = assinaturaDoDocumento(doc, empresa.razaoSocial)
  const temImagem = !!empresa.assinaturaDataUrl
  blocos.push(secaoBloco(c, secao, num(), "Aceite"))
  blocos.push({
    secao,
    altura: 8 + (temImagem ? 18 : 12) + 14,
    desenhar: (y) => {
      escrever(c, "Ao assinar, as partes concordam com o escopo, os valores e as condições descritos nesta proposta.", M, y + 4, { tam: 9.5, cor: PALETA.texto })
      const yl = y + 8 + (temImagem ? 18 : 12)
      const larg = (LARG - 16) / 2
      if (temImagem) {
        const prop = proporcao(c, empresa.assinaturaDataUrl)
        imagem(c, empresa.assinaturaDataUrl, "assinatura", M, yl - 16, Math.min(50, prop ? 15 / prop : 40), 15)
      }
      linhaH(c, M, M + larg, yl, PALETA.tinta)
      escrever(c, assinatura.nome, M, yl + 5, { peso: "bold", tam: 9.5, cor: PALETA.tinta })
      const cargo = [assinatura.cargo, empresa.razaoSocial || EMPRESA_PADRAO.razaoSocial].filter(Boolean).join(" · ")
      escrever(c, quebrar(c, cargo, larg, 8.5)[0] ?? "", M, yl + 9.5, { tam: 8.5, cor: PALETA.cinza })
      const x2 = M + larg + 16
      linhaH(c, x2, x2 + larg, yl, PALETA.tinta)
      escrever(c, doc.contato || doc.cliente, x2, yl + 5, { peso: "bold", tam: 9.5, cor: PALETA.tinta })
      if (doc.contato) escrever(c, quebrar(c, doc.cliente, larg, 8.5)[0] ?? "", x2, yl + 9.5, { tam: 8.5, cor: PALETA.cinza })
    },
  })
  return blocos
}

// ── Montagem ───────────────────────────────────────────────────────────

function montarBlocos(c: Ctx): Bloco[] {
  let n = 0
  const num = () => ++n
  // Ordem da revisão da IEX: institucional primeiro, depois o projeto.
  const blocos: Bloco[] = [
    secaoBloco(c, "Quem somos", num(), "Quem somos"),
    blocoQuemSomos(c, "Quem somos"),
    ...INSTITUCIONAL.quemSomos.flatMap((p) => blocosTexto(c, "Quem somos", p, 10.5)),
    ...blocosMetodologia(c, num),
  ]
  const secao = "Apresentação"
  blocos.push(
    secaoBloco(c, secao, num(), "Apresentação", true),
    ...blocosTexto(c, secao, c.doc.apresentacao || APRESENTACAO_PADRAO, 10.5),
  )
  const ficha = blocoFicha(c, secao)
  if (ficha) blocos.push(secaoBloco(c, secao, num(), "Dados do empreendimento"), ficha)
  blocos.push(...blocosEscopo(c, num), ...blocosCondicoes(c, num))
  return blocos
}

export function montarPdf(doc: PropostaDoc, empresa: EmpresaDoc, recursos: RecursosDoc): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true })
  const c: Ctx = { pdf, rec: recursos, doc, empresa, usar: registrarFontes(pdf, recursos.fontes) }
  desenharCapa(c)
  const blocos = montarBlocos(c)
  const paginas = paginar(blocos, BASE - TOPO)
  const total = paginas.length + 1
  paginas.forEach((indices, i) => {
    pdf.addPage()
    desenharMoldura(c, blocos[indices[0]].secao, i + 2, total)
    let y = TOPO
    for (const k of indices) {
      blocos[k].desenhar(y)
      y += blocos[k].altura
    }
  })
  return pdf
}

// Gera o PDF da proposta (PRD 008). Carrega fonte e imagens na primeira vez.
export async function gerarPdf(doc: PropostaDoc, empresa: EmpresaDoc, recursos?: RecursosDoc): Promise<Blob> {
  return montarPdf(doc, empresa, recursos ?? (await carregarRecursos())).output("blob")
}
