import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun,
} from "docx"
import { brl, type EmpresaDoc, type PropostaDoc } from "./tipos"
import { dataUrlParaImagem } from "./util"

const NAVY_PADRAO = "243658"
const GREY = "5A5A5A"

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; spacing?: number } = {}) {
  return new Paragraph({
    spacing: { after: opts.spacing ?? 80 },
    children: [new TextRun({ text, bold: opts.bold, size: (opts.size ?? 20), color: opts.color })],
  })
}

function secao(titulo: string, linhas: string[], cor: string): Paragraph[] {
  if (!linhas.length) return []
  return [
    new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: titulo, bold: true, size: 22, color: cor })] }),
    ...linhas.map((l) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: l, size: 20 })] })),
  ]
}

// Gera o .docx da proposta (PRD 008). Retorna Blob para download/anexo.
export async function gerarWord(doc: PropostaDoc, empresa: EmpresaDoc): Promise<Blob> {
  // Cor de marca (hex sem "#"); cai para o navy institucional quando não configurada.
  const NAVY = empresa.corPrimaria || NAVY_PADRAO

  // Logo e assinatura (mesmas imagens do PDF, para paridade de conteúdo).
  const logoImg = dataUrlParaImagem(empresa.logoDataUrl)
  const assinaturaImg = dataUrlParaImagem(empresa.assinaturaDataUrl)
  const logoParagrafo = logoImg
    ? [new Paragraph({ spacing: { after: 80 }, children: [new ImageRun({ type: logoImg.tipo, data: logoImg.data, transformation: { width: 150, height: 63 } })] })]
    : []
  const assinaturaParagrafo = assinaturaImg
    ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 0 }, children: [new ImageRun({ type: assinaturaImg.tipo, data: assinaturaImg.data, transformation: { width: 160, height: 60 } })] })
    : null
  const cell = (txt: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; fill?: string; color?: string } = {}) =>
    new TableCell({
      shading: opts.fill ? { fill: opts.fill } : undefined,
      children: [new Paragraph({ alignment: opts.align, children: [new TextRun({ text: txt, bold: opts.bold, size: 20, color: opts.color })] })],
    })

  const linhasTabela = doc.itens.map((i) =>
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: i.disciplina, bold: true, size: 20 })] }),
            ...(i.escopo ?? []).map((e) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: e, size: 18, color: GREY })] })),
          ],
        }),
        cell(brl(i.valor), { align: AlignmentType.RIGHT }),
      ],
    }),
  )

  const meta: [string, string][] = [
    ["Cliente", doc.cliente], ["Contato", doc.contato],
    ["Empreendimento", doc.empreendimento], ["Tipo", doc.tipo],
    ["Local", [doc.cidade, doc.uf].filter(Boolean).join("/")], ["Área", `${doc.area.toLocaleString("pt-BR")} m²`],
  ]

  const documento = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        ...logoParagrafo,
        new Paragraph({ children: [new TextRun({ text: empresa.razaoSocial || "IEX Projetos", bold: true, size: 30, color: NAVY })] }),
        p([empresa.cnpj && `CNPJ ${empresa.cnpj}`, empresa.endereco].filter(Boolean).join(" — "), { size: 16, color: GREY }),
        p([empresa.telefone, empresa.email].filter(Boolean).join(" · "), { size: 16, color: GREY, spacing: 160 }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { after: 120 }, children: [new TextRun({ text: `Proposta Comercial ${doc.numero}`, bold: true, size: 26, color: NAVY })] }),

        ...meta.map(([k, v]) => new Paragraph({ spacing: { after: 40 }, children: [
          new TextRun({ text: `${k}: `, bold: true, size: 20 }),
          new TextRun({ text: v || "—", size: 20 }),
        ] })),

        new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: "Serviços e investimento", bold: true, size: 22, color: NAVY })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: [cell("Disciplina / Serviço", { bold: true, fill: NAVY, color: "FFFFFF" }), cell("Investimento", { bold: true, fill: NAVY, color: "FFFFFF", align: AlignmentType.RIGHT })] }),
            ...linhasTabela,
            new TableRow({ children: [cell("Investimento total", { bold: true, fill: "F0F2F6" }), cell(brl(doc.total), { bold: true, fill: "F0F2F6", align: AlignmentType.RIGHT })] }),
          ],
        }),

        ...secao(`Condições de pagamento — ${doc.formaPagamento}`, (doc.parcelas ?? []).map((pp) => `${pp.desc}: ${brl(pp.valor)}`), NAVY),
        ...secao("Prazo e validade", [`Prazo de execução: ${doc.prazoExecucao}`, `Validade da proposta: ${doc.validade}`], NAVY),
        ...secao("Premissas e Entregáveis (Encargos da Contratada)", doc.premissas, NAVY),
        ...secao("Exclusões (Encargos do Contratante)", doc.exclusoes, NAVY),
        ...secao("Observações", doc.observacoes ? [doc.observacoes] : [], NAVY),
        ...secao("Dados bancários", empresa.dadosBancarios ? [empresa.dadosBancarios.banco, empresa.dadosBancarios.agencia && `Ag. ${empresa.dadosBancarios.agencia}`, empresa.dadosBancarios.conta && `C/C ${empresa.dadosBancarios.conta}`, empresa.dadosBancarios.pix && `PIX ${empresa.dadosBancarios.pix}`, empresa.dadosBancarios.favorecido].filter(Boolean) as string[] : [], NAVY),

        ...(assinaturaParagrafo ? [assinaturaParagrafo] : []),
        new Paragraph({ spacing: { before: assinaturaParagrafo ? 40 : 400 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: "888888", space: 6 } }, children: [new TextRun({ text: doc.responsavel || empresa.razaoSocial, size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: `Diretor Executivo · ${empresa.razaoSocial || "IEX Projetos"}`, size: 16, color: GREY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: empresa.textoRodape || "Powered by YRM Strategy Lab", size: 14, color: "9AA0A6" })] }),
      ],
    }],
  })

  return Packer.toBlob(documento)
}
