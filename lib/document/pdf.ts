import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { brl, type EmpresaDoc, type PropostaDoc } from "./tipos"

const NAVY: [number, number, number] = [36, 54, 88]
const DARK: [number, number, number] = [38, 44, 56]
const MUTED: [number, number, number] = [120, 128, 142]
const LINE: [number, number, number] = [223, 228, 235]
const BAND: [number, number, number] = [244, 246, 250]

// Gera o PDF da proposta (PRD 008). Retorna um Blob para download/anexo.
export function gerarPdf(doc: PropostaDoc, empresa: EmpresaDoc): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  const M = 48
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  let y = 0

  // Faixa de acento superior
  pdf.setFillColor(...NAVY)
  pdf.rect(0, 0, W, 6, "F")
  y = 48

  // Cabeçalho institucional
  const headerX = empresa.logoDataUrl ? M + 104 : M
  if (empresa.logoDataUrl) {
    try { pdf.addImage(empresa.logoDataUrl, "PNG", M, y - 6, 90, 38) } catch {}
  }
  pdf.setFont("helvetica", "bold").setFontSize(15).setTextColor(...NAVY)
  pdf.text(empresa.razaoSocial || "IEX Projetos", headerX, y + 6)
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED)
  const infoEmpresa = [
    empresa.cnpj && `CNPJ ${empresa.cnpj}`,
    empresa.endereco,
    [empresa.telefone, empresa.email].filter(Boolean).join("  ·  "),
  ].filter(Boolean) as string[]
  pdf.text(infoEmpresa, headerX, y + 20, { lineHeightFactor: 1.4 })

  // Bloco direito: número + data
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED)
  pdf.text("PROPOSTA COMERCIAL", W - M, y - 2, { align: "right" })
  pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(...NAVY)
  pdf.text(doc.numero, W - M, y + 13, { align: "right" })
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED)
  pdf.text(new Date().toLocaleDateString("pt-BR"), W - M, y + 26, { align: "right" })

  y += 44
  pdf.setDrawColor(...LINE).setLineWidth(0.8).line(M, y, W - M, y)
  y += 22

  // Destinatário
  pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(...DARK)
  pdf.text(`À ${doc.cliente}`, M, y)
  y += 13
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED)
  if (doc.contato) { pdf.text(`A/C ${doc.contato}`, M, y); y += 12 }
  const local = [doc.cidade, doc.uf].filter(Boolean).join("/")
  if (local) { pdf.text(local, M, y); y += 12 }
  y += 8

  // Referência (com acento à esquerda)
  pdf.setFillColor(...NAVY).rect(M, y - 9, 2.4, 16, "F")
  pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...DARK)
  pdf.text("Ref.: ", M + 10, y + 2)
  const refW = pdf.getTextWidth("Ref.: ")
  pdf.setFont("helvetica", "normal").setTextColor(...MUTED)
  pdf.text(pdf.splitTextToSize(`Projetos de engenharia — ${doc.empreendimento}`, W - M - (M + 10 + refW)), M + 10 + refW, y + 2)
  y += 24

  // Quadro de áreas
  sectionLabel(pdf, "QUADRO DE ÁREAS", M, y); y += 14
  pdf.setDrawColor(...LINE).setLineWidth(0.8).roundedRect(M, y, W - 2 * M, 24, 3, 3, "S")
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED).text("Área total de intervenção", M + 12, y + 15)
  pdf.setFont("helvetica", "bold").setTextColor(...DARK).text(`${doc.area.toLocaleString("pt-BR")} m²`, W - M - 12, y + 15, { align: "right" })
  y += 38

  // Serviços / valores
  sectionLabel(pdf, "SERVIÇOS PREVISTOS E ESCOPO", M, y); y += 8
  autoTable(pdf, {
    startY: y,
    head: [["Disciplina / Serviço", "Investimento"]],
    body: doc.itens.map((i) => [
      i.escopo?.length ? `${i.disciplina}\n${i.escopo.map((e) => `•  ${e}`).join("\n")}` : i.disciplina,
      brl(i.valor),
    ]),
    theme: "plain",
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold", cellPadding: { top: 6, bottom: 6, left: 10, right: 10 } },
    bodyStyles: { fontSize: 8.5, valign: "top", textColor: DARK, cellPadding: { top: 8, bottom: 8, left: 10, right: 10 } },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 100, fontStyle: "bold" } },
    didParseCell: (d) => {
      // Realça a 1ª linha (nome da disciplina) em negrito, escopo fica normal.
      if (d.section === "body" && d.column.index === 0 && typeof d.cell.raw === "string") {
        d.cell.styles.fontStyle = "normal"
      }
    },
    margin: { left: M, right: M },
  })
  y = (pdf as any).lastAutoTable.finalY + 18

  // Investimento total (faixa destacada)
  if (y > H - 90) { pdf.addPage(); y = M }
  pdf.setFillColor(...BAND).setDrawColor(...LINE).setLineWidth(0.8).roundedRect(M, y, W - 2 * M, 38, 4, 4, "FD")
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED).text("INVESTIMENTO TOTAL", M + 14, y + 16)
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED).text("Valor global da proposta", M + 14, y + 28)
  pdf.setFont("helvetica", "bold").setFontSize(16).setTextColor(...NAVY).text(brl(doc.total), W - M - 14, y + 25, { align: "right" })
  y += 56

  const bloco = (titulo: string, linhas: string[]) => {
    if (!linhas.length) return
    if (y > H - 110) { pdf.addPage(); y = M }
    sectionLabel(pdf, titulo.toUpperCase(), M, y); y += 15
    pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(80, 88, 100)
    for (const l of linhas) {
      const wrapped = pdf.splitTextToSize(`•  ${l}`, W - 2 * M - 6)
      if (y > H - 60) { pdf.addPage(); y = M }
      pdf.text(wrapped, M + 6, y)
      y += wrapped.length * 12 + 2
    }
    y += 12
  }

  // Pagamento
  if (doc.parcelas?.length) {
    bloco(`Condições de pagamento — ${doc.formaPagamento}`, doc.parcelas.map((p) => `${p.desc}: ${brl(p.valor)}`))
  }
  bloco("Prazo e validade", [`Prazo de execução: ${doc.prazoExecucao}`, `Validade da proposta: ${doc.validade}`])
  if (empresa.dadosBancarios) {
    const b = empresa.dadosBancarios
    bloco("Dados bancários", [b.banco, b.agencia && `Ag. ${b.agencia}`, b.conta && `C/C ${b.conta}`, b.pix && `PIX ${b.pix}`, b.favorecido].filter(Boolean) as string[])
  }

  // Encargos (nova página para respirar)
  pdf.addPage(); y = M
  bloco("Premissas e Entregáveis (Encargos da Contratada)", doc.premissas)
  bloco("Exclusões (Encargos do Contratante)", doc.exclusoes)
  if (doc.observacoes) bloco("Observações", [doc.observacoes])

  // Assinatura + rodapé
  if (y > H - 150) { pdf.addPage(); y = M }
  y += 36
  const cx = W / 2
  if (empresa.assinaturaDataUrl) { try { pdf.addImage(empresa.assinaturaDataUrl, "PNG", cx - 60, y - 44, 120, 44) } catch {} }
  pdf.setDrawColor(...LINE).setLineWidth(0.8).line(cx - 110, y, cx + 110, y); y += 14
  pdf.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...DARK).text(doc.responsavel || empresa.razaoSocial, cx, y, { align: "center" }); y += 12
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED).text(`Diretor Executivo · ${empresa.razaoSocial || "IEX Projetos"}`, cx, y, { align: "center" })

  pdf.setFontSize(7.5).setTextColor(165, 170, 180)
  pdf.text(empresa.textoRodape || "Powered by YRM Strategy Lab", cx, H - 26, { align: "center" })

  return pdf.output("blob")
}

// Rótulo de seção (eyebrow) em navy/maiúsculas.
function sectionLabel(pdf: jsPDF, texto: string, x: number, y: number) {
  pdf.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...NAVY)
  pdf.text(texto, x, y)
}
