import {
  AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionRelativeFrom, ImageRun, Packer,
  PageNumber, Paragraph, ShadingType, Table, TableAnchorType, TableCell, TableLayoutType, TableRow, TextRun, TextWrappingType,
  VerticalAlignTable, VerticalPositionRelativeFrom, WidthType,
} from "docx"
import { identificacaoDocumento } from "@/lib/propostas/identificadores"
import {
  APRESENTACAO_PADRAO, EMPRESA_PADRAO, INSTITUCIONAL, PALETA, RODAPE_PADRAO, contatoRodape, dataPorExtenso,
  fichaEmpreendimento, formatarArea, formatarPercentual, iconeDisciplina, linhasBancarias, percentual,
  rotuloParcela, subtituloCapa, tituloCapa,
} from "./layout-a"
import { carregarRecursos, type PesoFonte, type RecursosDoc } from "./recursos"
import { assinaturaDoDocumento, brl, type EmpresaDoc, type PropostaDoc } from "./tipos"
import { dataUrlParaImagem } from "./util"

// Word da proposta no layout "Modelo A v2" (spec 2026-10-01). O Word não
// desenha a capa diagonal: ela entra como imagem atrás do texto, que segue
// editável. O resto são tabelas sombreadas. Medidas em mm convertidas para
// twips (texto, células) e pixels a 96 dpi (imagens).

const TW = 56.7
const PX = 3.78
const PAGINA = { width: 11906, height: 16838 }
const MARGEM = Math.round(18 * TW)
const LARG = PAGINA.width - 2 * MARGEM
const FONTE = "Manrope"
const hx = (cor: string) => cor.replace("#", "").toUpperCase()
const pad = (n: number) => String(n).padStart(2, "0")

type Filho = Paragraph | Table
type Alinhamento = (typeof AlignmentType)[keyof typeof AlignmentType]

type Borda = { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }
const NENHUMA: Borda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
const SEM_BORDAS = { top: NENHUMA, bottom: NENHUMA, left: NENHUMA, right: NENHUMA }
const borda = (cor: string, tam = 4): Borda => ({ style: BorderStyle.SINGLE, size: tam, color: hx(cor) })

interface OpcoesRun { peso?: PesoFonte; tam: number; cor: string; caixaAlta?: boolean; espaco?: number }

function run(texto: string, o: OpcoesRun, quebra?: number) {
  return new TextRun({
    break: quebra,
    text: o.caixaAlta ? texto.toUpperCase() : texto,
    font: FONTE,
    bold: (o.peso ?? "regular") !== "regular",
    size: Math.round(o.tam * 2),
    color: hx(o.cor),
    characterSpacing: o.espaco ? Math.round(o.tam * 20 * o.espaco) : undefined,
  })
}

interface OpcoesPar { alinhar?: Alinhamento; antes?: number; depois?: number; manterProximo?: boolean; quebraAntes?: boolean; bordaInferior?: string; bordaSuperior?: string }

function par(filhos: (TextRun | ImageRun)[], o: OpcoesPar = {}) {
  return new Paragraph({
    children: filhos,
    alignment: o.alinhar,
    keepNext: o.manterProximo,
    keepLines: true,
    pageBreakBefore: o.quebraAntes,
    spacing: { before: Math.round((o.antes ?? 0) * TW), after: Math.round((o.depois ?? 1.5) * TW) },
    border: o.bordaInferior || o.bordaSuperior
      ? {
          ...(o.bordaInferior ? { bottom: { ...borda(o.bordaInferior), space: 4 } } : {}),
          ...(o.bordaSuperior ? { top: { ...borda(o.bordaSuperior), space: 4 } } : {}),
        }
      : undefined,
  })
}

function dimensoes(bytes: Uint8Array, tipo: string): { w: number; h: number } | null {
  if (tipo === "png" && bytes.length > 24) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { w: v.getUint32(16), h: v.getUint32(20) }
  }
  if (tipo === "jpg") {
    let i = 2
    while (i + 9 < bytes.length && bytes[i] === 0xff) {
      const marca = bytes[i + 1]
      const tam = (bytes[i + 2] << 8) | bytes[i + 3]
      if (marca >= 0xc0 && marca <= 0xc3) return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] }
      i += 2 + tam
    }
  }
  return null
}

// Cada desenho precisa de um wp:docPr id único no arquivo; o Word reclama de
// duplicados. montarWord é síncrono, então um contador de módulo zerado a cada
// montagem basta (o cabeçalho é criado na mesma chamada).
let idDesenho = 0
const altTexto = (nome: string) => ({ id: String(++idDesenho), name: `${nome} ${idDesenho}`, description: nome })

function imagemRun(url: string | null | undefined, larguraMm: number, alturaMm?: number, nome = "Imagem"): ImageRun | null {
  const img = dataUrlParaImagem(url)
  if (!img) return null
  const d = dimensoes(img.data, img.tipo)
  const altura = alturaMm ?? (d ? (larguraMm * d.h) / d.w : larguraMm)
  // Largura 0 = "pela proporção da altura"; sem dimensões legíveis, quadrado.
  const largura = alturaMm && !larguraMm ? (d ? (alturaMm * d.w) / d.h : alturaMm) : larguraMm
  return new ImageRun({
    type: img.tipo,
    data: img.data,
    transformation: { width: Math.round(largura * PX), height: Math.round(altura * PX) },
    altText: altTexto(nome),
  })
}

// Texto com quebras de linha: o Word trata LF dentro de w:t como espaço.
function linhasDe(texto: string): string[] {
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
}

function runsComQuebra(texto: string, o: OpcoesRun): TextRun[] {
  return texto.split(/\r?\n/).map((linha, i) => {
    return run(linha, o, i === 0 ? undefined : 1)
  })
}

// Um parágrafo por linha não vazia; o espaço final só no último.
function paragrafos(texto: string, o: OpcoesRun, depois: number): Paragraph[] {
  const linhas = linhasDe(texto)
  return linhas.map((l, i) => par([run(l, o)], { depois: i === linhas.length - 1 ? depois : 1.5 }))
}

interface OpcoesCel { largura: number; fundo?: string; margem?: number; alinharV?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable]; colunas?: number; bordas?: Partial<Record<"top" | "bottom" | "left" | "right", Borda>> }

function celula(filhos: Filho[], o: OpcoesCel) {
  const m = Math.round((o.margem ?? 0) * TW)
  return new TableCell({
    children: filhos.length ? filhos : [par([])],
    width: { size: o.largura, type: WidthType.DXA },
    columnSpan: o.colunas,
    verticalAlign: o.alinharV,
    shading: o.fundo ? { type: ShadingType.CLEAR, color: "auto", fill: hx(o.fundo) } : undefined,
    margins: { top: m, bottom: m, left: m, right: m },
    borders: { ...SEM_BORDAS, ...o.bordas },
  })
}

const linhaT = (celulas: TableCell[]) => new TableRow({ children: celulas, cantSplit: true })

function tabela(linhas: TableRow[], larguras: number[], extra: Partial<ConstructorParameters<typeof Table>[0]> = {}) {
  return new Table({
    rows: linhas,
    columnWidths: larguras,
    width: { size: larguras.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: { ...SEM_BORDAS, insideHorizontal: NENHUMA, insideVertical: NENHUMA },
    ...extra,
  })
}

const dividir = (total: number, pesos: number[]) => {
  const soma = pesos.reduce((a, b) => a + b, 0)
  const partes = pesos.map((p) => Math.floor((total * p) / soma))
  partes[partes.length - 1] += total - partes.reduce((a, b) => a + b, 0)
  return partes
}

function tituloSecao(n: number, titulo: string, quebraAntes = false) {
  return par(
    [run(`${pad(n)}   `, { tam: 10, cor: PALETA.dourado }), run(titulo, { peso: "extrabold", tam: 17, cor: PALETA.navy })],
    { antes: quebraAntes ? 0 : 6, depois: 4, manterProximo: true, quebraAntes, bordaInferior: PALETA.linha },
  )
}

// ── Capa ────────────────────────────────────────────────────────────────

function capa(doc: PropostaDoc, rec: RecursosDoc): Filho[] {
  const hoje = new Date()
  const primeira: (TextRun | ImageRun)[] = []
  const fundo = dataUrlParaImagem(rec.imagens.capaWord)
  if (fundo) {
    primeira.push(new ImageRun({
      type: fundo.tipo,
      data: fundo.data,
      altText: altTexto("Fundo da capa"),
      transformation: { width: Math.round(210 * PX), height: Math.round(297 * PX) },
      floating: {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
        behindDocument: true,
        allowOverlap: true,
        wrap: { type: TextWrappingType.NONE },
      },
    }))
  }
  // Sem o fundo escuro a capa é folha branca: logo e títulos em navy.
  const sobreFundo = Boolean(fundo)
  const corTitulo = sobreFundo ? PALETA.branco : PALETA.navy
  const corSub = sobreFundo ? PALETA.suaveNoNavy : PALETA.cinza
  const logo = sobreFundo ? imagemRun(rec.imagens.logoBranco, 32, undefined, "Logo IEX Projetos") : null
  if (logo) primeira.push(logo)
  else primeira.push(run("IEX PROJETOS", { peso: "extrabold", tam: 16, cor: corTitulo }))
  const larguras = dividir(LARG, [1.3, 1, 1])
  const colunas: [string, string, string][] = [
    ["Cliente", doc.cliente, doc.contato ? `A/C ${doc.contato}` : ""],
    ["Proposta", identificacaoDocumento(doc.numero, doc.versao), ""],
    ["Emitida em", dataPorExtenso(hoje), doc.validade ? `Validade: ${doc.validade}` : ""],
  ]
  return [
    par(primeira, { depois: 0 }),
    par([run("Proposta técnica e comercial", { peso: "bold", tam: 9, cor: PALETA.dourado, caixaAlta: true, espaco: 0.2 })], { antes: 61, depois: 3 }),
    ...tituloCapa(doc.empreendimento).map((l) => par([run(l, { peso: "extrabold", tam: 38, cor: corTitulo })], { depois: 0 })),
    par([run(subtituloCapa(doc.itens), { tam: 10.5, cor: corSub })], { antes: 5 }),
    tabela(
      [linhaT(colunas.map(([rotulo, valor, sub], i) =>
        celula([
          par([run(rotulo, { tam: 7.5, cor: PALETA.cinza, caixaAlta: true, espaco: 0.12 })], { depois: 1 }),
          par([run(valor || "—", { peso: "bold", tam: 10.5, cor: PALETA.tinta })], { depois: 0.5 }),
          ...(sub ? [par([run(sub, { tam: 8.5, cor: PALETA.cinza })], { depois: 0 })] : []),
        ], { largura: larguras[i], margem: 1, bordas: { left: borda(PALETA.dourado, 12) } }),
      ))],
      larguras,
      { float: { horizontalAnchor: TableAnchorType.PAGE, verticalAnchor: TableAnchorType.PAGE, absoluteHorizontalPosition: MARGEM, absoluteVerticalPosition: Math.round(256 * TW) } },
    ),
  ]
}

// ── Cabeçalho e rodapé ─────────────────────────────────────────────────

function cabecalho(doc: PropostaDoc, rec: RecursosDoc) {
  const l = dividir(LARG, [1, 2.5, 1.5])
  const logo = imagemRun(rec.imagens.logoBranco, 12, undefined, "Logo IEX Projetos")
  const cel = (filhos: Filho[], largura: number) => celula(filhos, { largura, fundo: PALETA.navy, margem: 2, alinharV: VerticalAlignTable.CENTER })
  return new Header({
    children: [tabela([linhaT([
      cel([par(logo ? [logo] : [run("IEX PROJETOS", { peso: "bold", tam: 9, cor: PALETA.branco })], { depois: 0 })], l[0]),
      cel([par([run("Proposta técnica e comercial", { tam: 7.5, cor: PALETA.branco, caixaAlta: true, espaco: 0.16 })], { alinhar: AlignmentType.CENTER, depois: 0 })], l[1]),
      cel([par([run(identificacaoDocumento(doc.numero, doc.versao), { tam: 7.5, cor: PALETA.branco })], { alinhar: AlignmentType.RIGHT, depois: 0 })], l[2]),
    ])], l), new Paragraph({})],
  })
}

function rodape(empresa: EmpresaDoc) {
  const l = [LARG - 1500, 1500]
  return new Footer({
    children: [tabela([linhaT([
      celula([
        par([run(contatoRodape(empresa), { tam: 7, cor: PALETA.cinza })], { depois: 0.5 }),
        par([run(empresa.textoRodape || RODAPE_PADRAO, { tam: 6.5, cor: PALETA.cinzaClaro })], { depois: 0 }),
      ], { largura: l[0], margem: 1, bordas: { top: borda(PALETA.linha) } }),
      celula([
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], font: FONTE, size: 14, color: hx(PALETA.cinza) })],
        }),
      ], { largura: l[1], margem: 1, bordas: { top: borda(PALETA.linha) } }),
    ])], l), new Paragraph({})],
  })
}

// ── Quem somos e apresentação ──────────────────────────────────────────

// Painel com foto, mapa e números; o texto institucional da IEX vem em
// parágrafos abaixo (montarWord).
function quemSomos(rec: RecursosDoc): Table {
  const l = dividir(LARG, [3.3, 3.6, 2.96])
  const socios = imagemRun(rec.imagens.socios, 48, undefined, "Sócios fundadores")
  const mapa = imagemRun(rec.imagens.mapa, 54, undefined, "Mapa de atuação")
  const numeros = INSTITUCIONAL.numeros.flatMap((n) => [
    ...(n.prefixo ? [par([run(n.prefixo, { tam: 7.5, cor: PALETA.suaveNoPainel })], { depois: 0 })] : []),
    par([run(n.valor, { peso: "extrabold", tam: 24, cor: PALETA.branco })], { depois: 0 }),
    par([run(n.rotulo, { peso: "semibold", tam: 7.8, cor: PALETA.azulClaro })], { depois: 4 }),
  ])
  const cel = (filhos: Filho[], largura: number, alinharV: OpcoesCel["alinharV"] = VerticalAlignTable.CENTER) => celula(filhos, { largura, fundo: PALETA.painel, margem: 4, alinharV })
  return tabela([
    linhaT([
      cel([
        par(socios ? [socios] : [], { depois: 1 }),
        par([run(INSTITUCIONAL.socios, { peso: "bold", tam: 8, cor: PALETA.branco })], { depois: 0 }),
        par([run(INSTITUCIONAL.sociosLegenda, { tam: 7, cor: PALETA.suaveNoPainel })], { depois: 0 }),
      ], l[0], VerticalAlignTable.BOTTOM),
      cel([par(mapa ? [mapa] : [], { alinhar: AlignmentType.CENTER, depois: 0 })], l[1]),
      cel(numeros, l[2]),
    ]),
  ], l, { layout: TableLayoutType.FIXED })
}

function ficha(doc: PropostaDoc): Table | null {
  const campos = fichaEmpreendimento(doc)
  if (!campos.length) return null
  const l = dividir(LARG, [1, 1, 1])
  const linhas: TableRow[] = []
  for (let i = 0; i < campos.length; i += 3) {
    const grupo = campos.slice(i, i + 3)
    linhas.push(linhaT(l.map((largura, k) => {
      const campo = grupo[k]
      return celula(campo ? [
        par([run(campo[0], { tam: 7, cor: PALETA.cinza, caixaAlta: true, espaco: 0.14 })], { depois: 1 }),
        par([run(campo[1], { peso: "bold", tam: 10, cor: PALETA.tinta })], { depois: 0 }),
      ] : [], { largura, margem: 3, bordas: { top: borda(PALETA.linha), bottom: borda(PALETA.linha), left: borda(PALETA.linha), right: borda(PALETA.linha) } })
    })))
  }
  return tabela(linhas, l)
}

// ── Metodologia ────────────────────────────────────────────────────────

function metodologia(rec: RecursosDoc, num: () => number): Filho[] {
  const foto = imagemRun(rec.imagens.metodologia, 174, 56, "Foto da metodologia")
  const l3 = dividir(LARG, [1, 1, 1])
  const l4 = dividir(LARG, [1, 1, 1, 1])
  const bordaCard = { top: borda(PALETA.linha), bottom: borda(PALETA.linha), left: borda(PALETA.linha), right: borda(PALETA.linha) }
  return [
    tituloSecao(num(), "Como trabalhamos", true),
    ...(foto ? [par([foto], { depois: 2 })] : []),
    par([
      run("Engenharia integrada  ", { tam: 8, cor: PALETA.cinza, caixaAlta: true, espaco: 0.14 }),
      run(INSTITUCIONAL.metodologiaChamada, { peso: "bold", tam: 12, cor: PALETA.navy }),
    ], { depois: 4 }),
    tabela([linhaT(INSTITUCIONAL.diferenciais.map((d, i) => {
      const icone = imagemRun(rec.icones[d.icone], 6, undefined, d.titulo)
      return celula([
        par(icone ? [icone] : [], { depois: 2 }),
        par([run(d.titulo, { peso: "bold", tam: 10.5, cor: PALETA.navy })], { depois: 1 }),
        par([run(d.texto, { tam: 8.4, cor: PALETA.textoCard })], { depois: 0 }),
      ], { largura: l3[i], margem: 4, bordas: bordaCard })
    }))], l3),
    tituloSecao(num(), "Nossas especialidades"),
    tabela([linhaT(INSTITUCIONAL.especialidades.map((e, i) =>
      celula([
        par([run(e.titulo, { peso: "bold", tam: 9.5, cor: PALETA.navy })], { depois: 1.5 }),
        ...e.itens.map((it) => par([run(it, { tam: 7.8, cor: PALETA.textoCard })], { depois: 0.5 })),
      ], { largura: l4[i], fundo: PALETA.faixa, margem: 3.5, bordas: { top: borda(PALETA.dourado, 12), left: borda(PALETA.branco, 12), right: borda(PALETA.branco, 12) } }),
    ))], l4),
  ]
}

// ── Escopo ─────────────────────────────────────────────────────────────

function escopo(doc: PropostaDoc, rec: RecursosDoc, num: () => number): Filho[] {
  const l = [Math.round(14 * TW), LARG - Math.round(14 * TW) - Math.round(38 * TW), Math.round(38 * TW)]
  const linhas = doc.itens.map((item) => {
    const icone = imagemRun(rec.icones[iconeDisciplina(item.disciplina)], 6, undefined, item.disciplina)
    const bordas = { bottom: borda(PALETA.linha) }
    return linhaT([
      celula([par(icone ? [icone] : [], { depois: 0 })], { largura: l[0], margem: 2, bordas }),
      celula([
        par([run(item.disciplina, { peso: "bold", tam: 11.5, cor: PALETA.navy })], { depois: 1 }),
        ...(item.escopo ?? []).map((e) => par([run("–  ", { tam: 9, cor: PALETA.dourado }), run(e, { tam: 9, cor: PALETA.textoCard })], { depois: 0.5 })),
      ], { largura: l[1], margem: 2, bordas }),
      celula([par([run(brl(item.valor), { peso: "bold", tam: 11, cor: PALETA.tinta })], { alinhar: AlignmentType.RIGHT, depois: 0 })], { largura: l[2], margem: 2, bordas }),
    ])
  })
  const lt = dividir(LARG, [1.4, 1])
  return [
    // Sem quebra: o escopo continua na página da apresentação (revisão da IEX).
    tituloSecao(num(), "Escopo por disciplina"),
    ...(linhas.length ? [tabela(linhas, l)] : []),
    par([], { depois: 3 }),
    tabela([linhaT([
      celula([
        par([run("Investimento total", { peso: "bold", tam: 8, cor: PALETA.dourado, caixaAlta: true, espaco: 0.2 })], { depois: 1 }),
        par([run(doc.area > 0 ? `Valor global para ${formatarArea(doc.area)}` : "Valor global da proposta", { tam: 9, cor: PALETA.suaveNoNavy })], { depois: 0 }),
      ], { largura: lt[0], fundo: PALETA.navy, margem: 6, alinharV: VerticalAlignTable.CENTER }),
      celula([par([run(brl(doc.total), { peso: "extrabold", tam: 24, cor: PALETA.branco })], { alinhar: AlignmentType.RIGHT, depois: 0 })], { largura: lt[1], fundo: PALETA.navy, margem: 6, alinharV: VerticalAlignTable.CENTER }),
    ])], lt),
  ]
}

// ── Condições ──────────────────────────────────────────────────────────

function cartao(titulo: string, linhas: [string, string, string?][], largura: number): Table {
  const l = dividir(largura, [1.6, 1])
  const bordaCard = borda(PALETA.linha)
  return tabela([
    linhaT([celula([par([run(titulo, { peso: "bold", tam: 8, cor: PALETA.cinza, caixaAlta: true, espaco: 0.12 })], { depois: 0 })], { largura, colunas: 2, margem: 3, bordas: { top: bordaCard, left: bordaCard, right: bordaCard } })]),
    ...linhas.map(([rotulo, valor, pill], i) => {
      const ultima = i === linhas.length - 1
      const bordas = { left: bordaCard, right: bordaCard, bottom: ultima ? bordaCard : borda(PALETA.linha, 2) }
      return linhaT([
        celula([par([...(pill ? [run(`${pill}  `, { peso: "bold", tam: 8, cor: PALETA.dourado })] : []), run(rotulo, { tam: 9.5, cor: PALETA.tinta })], { depois: 0 })], { largura: l[0], margem: 2.5, bordas: { ...bordas, right: NENHUMA } }),
        celula([par(runsComQuebra(valor, { peso: "bold", tam: 9.5, cor: PALETA.tinta }), { alinhar: AlignmentType.RIGHT, depois: 0 })], { largura: l[1], margem: 2.5, bordas: { ...bordas, left: NENHUMA } }),
      ])
    }),
  ], l)
}

function condicoes(doc: PropostaDoc, empresa: EmpresaDoc, num: () => number): Filho[] {
  const gap = Math.round(8 * TW)
  const col = Math.floor((LARG - gap) / 2)
  const pagamento: [string, string, string?][] = (doc.parcelas ?? []).length
    ? (doc.parcelas ?? []).map((p) => [rotuloParcela(p.desc), brl(p.valor), formatarPercentual(percentual(p.valor, doc.total))])
    : [[doc.formaPagamento || "A combinar", ""]]
  const banco = linhasBancarias(empresa.dadosBancarios)
  const prazo: [string, string][] = [
    ["Prazo de execução", doc.prazoExecucao || "—"],
    ["Validade da proposta", doc.validade || "—"],
    ...(banco.length ? [["Dados bancários", banco.join("\n")] as [string, string]] : []),
  ]
  const filhos: Filho[] = [
    tituloSecao(num(), "Condições comerciais", true),
    tabela([linhaT([
      celula([cartao(`Pagamento — ${doc.formaPagamento || "a combinar"}`, pagamento, col)], { largura: col }),
      celula([], { largura: gap }),
      celula([cartao("Prazo e validade", prazo, col)], { largura: col }),
    ])], [col, gap, col]),
  ]

  const colunas = [
    { titulo: "Incluso", itens: doc.premissas.filter((s) => s?.trim()), marca: "✓", cor: PALETA.verde },
    { titulo: "Não incluso", itens: doc.exclusoes.filter((s) => s?.trim()), marca: "—", cor: PALETA.vermelho },
  ].filter((c) => c.itens.length)
  if (colunas.length) {
    const larguras = colunas.length === 2 ? [col, gap, col] : [LARG]
    const blocos = colunas.map((c) => [
      tituloSecao(num(), c.titulo),
      ...c.itens.map((it) => par([run(`${c.marca}  `, { peso: "bold", tam: 9.5, cor: c.cor }), run(it, { tam: 9.5, cor: PALETA.texto })], { depois: 1, bordaInferior: PALETA.linha })),
    ])
    filhos.push(tabela([linhaT(
      colunas.length === 2
        ? [celula(blocos[0], { largura: col }), celula([], { largura: gap }), celula(blocos[1], { largura: col })]
        : [celula(blocos[0], { largura: LARG })],
    )], larguras))
  }

  if (doc.observacoes?.trim()) {
    filhos.push(tituloSecao(num(), "Observações"), ...paragrafos(doc.observacoes, { tam: 9.5, cor: PALETA.texto }, 3))
  }

  const assinatura = assinaturaDoDocumento(doc, empresa.razaoSocial)
  const imagemAssinatura = imagemRun(empresa.assinaturaDataUrl, 0, 15, "Assinatura")
  filhos.push(
    tituloSecao(num(), "Aceite"),
    par([run("Ao assinar, as partes concordam com o escopo, os valores e as condições descritos nesta proposta.", { tam: 9.5, cor: PALETA.texto })], { depois: 4 }),
    tabela([linhaT([
      celula([
        par(imagemAssinatura ? [imagemAssinatura] : [], { antes: imagemAssinatura ? 0 : 10, depois: 0 }),
        par([run(assinatura.nome, { peso: "bold", tam: 9.5, cor: PALETA.tinta })], { depois: 0.5, bordaSuperior: PALETA.tinta }),
        par([run(`${assinatura.cargo} · ${empresa.razaoSocial || EMPRESA_PADRAO.razaoSocial}`, { tam: 8.5, cor: PALETA.cinza })], { depois: 0 }),
      ], { largura: col, alinharV: VerticalAlignTable.BOTTOM }),
      celula([], { largura: gap }),
      celula([
        par([run(doc.contato || doc.cliente, { peso: "bold", tam: 9.5, cor: PALETA.tinta })], { depois: 0.5, bordaSuperior: PALETA.tinta }),
        ...(doc.contato ? [par([run(doc.cliente, { tam: 8.5, cor: PALETA.cinza })], { depois: 0 })] : []),
      ], { largura: col, alinharV: VerticalAlignTable.BOTTOM }),
    ])], [col, gap, col]),
  )
  return filhos
}

// ── Montagem ───────────────────────────────────────────────────────────

export function montarWord(doc: PropostaDoc, empresa: EmpresaDoc, rec: RecursosDoc): Document {
  idDesenho = 0
  let n = 0
  const num = () => ++n
  const tabelaFicha = ficha(doc)
  const margens = { top: Math.round(27 * TW), bottom: Math.round(24 * TW), left: MARGEM, right: MARGEM, header: Math.round(6 * TW), footer: Math.round(8 * TW) }
  return new Document({
    styles: { default: { document: { run: { font: FONTE, size: 20, color: hx(PALETA.tinta) } } } },
    sections: [
      {
        properties: { page: { size: PAGINA, margin: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM } } },
        children: capa(doc, rec),
      },
      {
        properties: { page: { size: PAGINA, margin: margens } },
        headers: { default: cabecalho(doc, rec) },
        footers: { default: rodape(empresa) },
        // Ordem da revisão da IEX: institucional primeiro, depois o projeto.
        children: [
          tituloSecao(num(), "Quem somos"),
          quemSomos(rec),
          ...INSTITUCIONAL.quemSomos.map((p, i) => par([run(p, { tam: 10.5, cor: PALETA.texto })], { antes: i ? 0 : 5, depois: 4 })),
          ...metodologia(rec, num),
          tituloSecao(num(), "Apresentação", true),
          ...paragrafos(doc.apresentacao || APRESENTACAO_PADRAO, { tam: 10.5, cor: PALETA.texto }, 4),
          ...(tabelaFicha ? [tituloSecao(num(), "Dados do empreendimento"), tabelaFicha] : []),
          ...escopo(doc, rec, num),
          ...condicoes(doc, empresa, num),
          // O Word exige um parágrafo depois da última tabela do corpo.
          par([], { depois: 0 }),
        ],
      },
    ],
  })
}

// Gera o .docx da proposta (PRD 008). Carrega imagens na primeira vez.
export async function gerarWord(doc: PropostaDoc, empresa: EmpresaDoc, recursos?: RecursosDoc): Promise<Blob> {
  return Packer.toBlob(montarWord(doc, empresa, recursos ?? (await carregarRecursos())))
}
