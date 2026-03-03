import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ProceduralAct, Lawyer } from "../types";

export async function generateReportPdf(acts: ProceduralAct[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Helper to draw the "Law Scales" icon
  const drawLawIcon = (x: number, y: number, size: number) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    // Base
    doc.line(x - size/2, y + size, x + size/2, y + size);
    // Pillar
    doc.line(x, y, x, y + size);
    // Beam
    doc.line(x - size, y + size/4, x + size, y + size/4);
    // Left scale
    doc.line(x - size, y + size/4, x - size, y + size/1.5);
    doc.ellipse(x - size, y + size/1.5, size/3, size/6);
    // Right scale
    doc.line(x + size, y + size/4, x + size, y + size/1.5);
    doc.ellipse(x + size, y + size/1.5, size/3, size/6);
  };

  // Cover Page
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  
  drawLawIcon(pageWidth / 2, 60, 15);
  
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("JUSTO", pageWidth / 2, 100, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("SOLUÇÕES TECNOLÓGICAS", pageWidth / 2, 106, { align: "center" });
  
  doc.setDrawColor(200, 200, 200);
  doc.line(pageWidth / 2 - 30, 115, pageWidth / 2 + 30, 115);
  
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Distribuição Jurídica", pageWidth / 2, 140, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Documentos Processados: ${acts.length}`, pageWidth / 2, 150, { align: "center" });
  doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 158, { align: "center" });

  // Sort acts by priority before processing
  const sortedActs = [...acts].sort((a, b) => {
    const priorityTypes = ['alvará', 'sentença', 'acórdão'];
    const aType = a.type.toLowerCase();
    const bType = b.type.toLowerCase();
    
    const aPriority = priorityTypes.findIndex(t => aType.includes(t));
    const bPriority = priorityTypes.findIndex(t => bType.includes(t));
    
    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    return 0;
  });

  // Group acts by lawyer
  const lawyers = Object.values(Lawyer);
  
  lawyers.forEach((lawyer) => {
    const lawyerActs = sortedActs.filter(a => a.lawyer === lawyer);
    if (lawyerActs.length === 0) return;

    doc.addPage();
    
    // Lawyer Header
    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, pageWidth, 40, "F");
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(lawyer.toUpperCase(), 15, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Total de Atos: ${lawyerActs.length}`, 15, 33);

    let currentY = 55;

    lawyerActs.forEach((act, idx) => {
      const isAlvara = act.type.toLowerCase().includes('alvará');
      const isPriority = isAlvara || act.type.toLowerCase().includes('sentença') || act.type.toLowerCase().includes('acórdão');

      // Check for page break
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // Act Card
      if (isAlvara) {
        doc.setFillColor(240, 255, 240);
        doc.rect(15, currentY - 5, pageWidth - 30, 40, "F");
      } else if (isPriority) {
        doc.setFillColor(240, 245, 255);
        doc.rect(15, currentY - 5, pageWidth - 30, 40, "F");
      }

      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(15, currentY - 5, pageWidth - 15, currentY - 5);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}. ${act.title}`, 15, currentY);
      
      if (isPriority) {
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(isAlvara ? 0 : 0, isAlvara ? 150 : 100, isAlvara ? 0 : 200);
        doc.rect(pageWidth - 45, currentY - 4, 30, 5, "F");
        doc.text("PRIORIDADE", pageWidth - 30, currentY, { align: "center" });
      }

      currentY += 7;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(`PROCESSO: ${act.caseNumber}`, 15, currentY);
      doc.text(`TRIBUNAL: ${act.court} / ${act.chamber}`, 80, currentY);
      doc.text(`DATA: ${act.date || '-'}`, 150, currentY);
      currentY += 5;
      
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 100, 100);
      doc.text(`PARTES: ${act.parties}`, 15, currentY);
      currentY += 5;
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Tipo: ${act.type}`, 15, currentY);
      currentY += 8;

      doc.setTextColor(40, 40, 40);
      const splitSummary = doc.splitTextToSize(act.summary, pageWidth - 30);
      doc.text(splitSummary, 15, currentY);
      currentY += (splitSummary.length * 5) + 8;
    });
  });

  // Footer for all pages except cover
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(
      `Justo - Soluções Tecnológicas | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save("relatorio-justo-distribuicao.pdf");
}
