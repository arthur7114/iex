import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { brl, type EmpresaDoc, type PropostaDoc } from "./tipos"

// Gera o PDF da proposta (PRD 008). Retorna um Blob para download/anexo.
export function gerarPdf(doc: PropostaDoc, empresa: EmpresaDoc): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  const M = 40
  const W = pdf.internal.pageSize.getWidth()
  let y = M

  // Cabeçalho institucional
  if (empresa.logoDataUrl) {
    try { pdf.addImage(empresa.logoDataUrl, "PNG", M, y, 90, 40); } catch {}
  }
  pdf.setFont("helvetica", "bold").setFontSize(14).setTextColor(20, 40, 70)
  pdf.text(empresa.razaoSocial || "IEX Projetos", empresa.logoDataUrl ? M + 110 : M, y + 16)
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(90)
  const infoEmpresa = [empresa.cnpj && `CNPJ ${empresa.cnpj}`, empresa.endereco, [empresa.telefone, empresa.email].filter(Boolean).join(" · ")].filter(Boolean) as string[]
  pdf.text(infoEmpresa, empresa.logoDataUrl ? M + 110 : M, y + 30)
  y += 56
  pdf.setDrawColor(210).line(M, y, W - M, y)
  y += 20

  // Título
  pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(20, 40, 70)
  pdf.text(`Proposta Comercial ${doc.numero}`, M, y)
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(90)
  pdf.text(new Date().toLocaleDateString("pt-BR"), W - M, y, { align: "right" })
  y += 22

  // Cliente / Obra
  pdf.setFontSize(9).setTextColor(40)
  const meta: [string, string][] = [
    ["Cliente", doc.cliente], ["Contato", doc.contato],
    ["Empreendimento", doc.empreendimento], ["Tipo", doc.tipo],
    ["Local", [doc.cidade, doc.uf].filter(Boolean).join("/")], ["Área", `${doc.area.toLocaleString("pt-BR")} m²`],
  ]
  meta.forEach(([k, v], i) => {
    const col = i % 2
    const xx = M + col * (W - 2 * M) / 2
    if (col === 0 && i > 0) y += 16
    pdf.setFont("helvetica", "bold").text(`${k}: `, xx, y)
    pdf.setFont("helvetica", "normal").text(v || "—", xx + pdf.getTextWidth(`${k}: `), y)
  })
  y += 24

  // Disciplinas / valores
  autoTable(pdf, {
    startY: y,
    head: [["Disciplina / Serviço", "Investimento"]],
    body: doc.itens.map((i) => [
      i.escopo?.length ? `${i.disciplina}\n${i.escopo.map((e) => `• ${e}`).join("\n")}` : i.disciplina,
      brl(i.valor),
    ]),
    foot: [["Investimento total", brl(doc.total)]],
    theme: "grid",
    headStyles: { fillColor: [36, 54, 88], fontSize: 9 },
    footStyles: { fillColor: [240, 242, 246], textColor: [20, 40, 70], fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 8.5, valign: "top" },
    columnStyles: { 1: { halign: "right", cellWidth: 110 } },
    margin: { left: M, right: M },
  })
  y = (pdf as any).lastAutoTable.finalY + 20

  const bloco = (titulo: string, linhas: string[]) => {
    if (!linhas.length) return
    if (y > pdf.internal.pageSize.getHeight() - 120) { pdf.addPage(); y = M }
    pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(20, 40, 70).text(titulo, M, y); y += 14
    pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(50)
    for (const l of linhas) {
      const wrapped = pdf.splitTextToSize(`• ${l}`, W - 2 * M)
      pdf.text(wrapped, M, y); y += wrapped.length * 12
    }
    y += 8
  }

  // Pagamento
  if (doc.parcelas?.length) {
    bloco(`Condições de pagamento — ${doc.formaPagamento}`, doc.parcelas.map((p) => `${p.desc}: ${brl(p.valor)}`))
  }
  bloco("Prazo e validade", [`Prazo de execução: ${doc.prazoExecucao}`, `Validade da proposta: ${doc.validade}`])
  bloco("Premissas", doc.premissas)
  bloco("Exclusões", doc.exclusoes)
  if (doc.observacoes) bloco("Observações", [doc.observacoes])
  if (empresa.dadosBancarios) {
    const b = empresa.dadosBancarios
    bloco("Dados bancários", [b.banco, b.agencia && `Ag. ${b.agencia}`, b.conta && `C/C ${b.conta}`, b.pix && `PIX ${b.pix}`, b.favorecido].filter(Boolean) as string[])
  }

  // Assinatura + rodapé
  if (y > pdf.internal.pageSize.getHeight() - 120) { pdf.addPage(); y = M }
  y += 20
  if (empresa.assinaturaDataUrl) { try { pdf.addImage(empresa.assinaturaDataUrl, "PNG", M, y, 120, 50); y += 50 } catch {} }
  pdf.setDrawColor(120).line(M, y, M + 200, y); y += 12
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(40).text(doc.responsavel || empresa.razaoSocial, M, y)

  pdf.setFontSize(7.5).setTextColor(150)
  pdf.text(empresa.textoRodape || "Powered by YRM Strategy Lab", W / 2, pdf.internal.pageSize.getHeight() - 24, { align: "center" })

  return pdf.output("blob")
}
