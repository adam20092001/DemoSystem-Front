import { jsPDF } from 'jspdf';

type Pdf = jsPDF;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function plain(value: string): string {
  return value.replace(/[\u2010-\u2015]/g, '-').replace(/\u00a0/g, ' ');
}

export class PdfLayout {
  y = 39;

  constructor(readonly pdf: Pdf, private readonly footer: string) {}

  header(title: string, number: string, subtitle: string): void {
    this.pdf.setFillColor(37, 49, 61);
    this.pdf.rect(0, 0, PAGE_WIDTH, 32, 'F');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(17);
    this.pdf.text(plain(title), MARGIN, 13);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(9);
    this.pdf.text(plain(`${number}  |  ${subtitle}`), MARGIN, 23);
    this.pdf.setTextColor(38, 50, 56);
  }

  ensure(height: number): void {
    if (this.y + height <= PAGE_HEIGHT - 25) return;
    this.pdf.addPage();
    this.y = 20;
  }

  section(label: string): void {
    this.ensure(14);
    this.y += 6;
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(11);
    this.pdf.text(plain(label), MARGIN, this.y);
    this.y += 6;
  }

  line(label: string, value: string | null | undefined): void {
    if (!value) return;
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(9);
    const labelText = `${label}: `;
    const labelWidth = this.pdf.getTextWidth(plain(labelText));
    const lines = this.pdf.splitTextToSize(plain(value), CONTENT_WIDTH - labelWidth);
    this.ensure(Math.max(1, lines.length) * 4.5 + 1);
    this.pdf.text(plain(labelText), MARGIN, this.y);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(lines, MARGIN + labelWidth, this.y);
    this.y += Math.max(1, lines.length) * 4.5 + 1;
  }

  paragraph(value: string, color: [number, number, number] = [38, 50, 56]): void {
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8.5);
    const lines = this.pdf.splitTextToSize(plain(value), CONTENT_WIDTH);
    this.ensure(lines.length * 4.4 + 2);
    this.pdf.setTextColor(...color);
    this.pdf.text(lines, MARGIN, this.y);
    this.pdf.setTextColor(38, 50, 56);
    this.y += lines.length * 4.4 + 2;
  }

  product(data: { sku: string; name: string; quantity: string; unit: string; price: string; total: string; details?: string[]; image?: string }): void {
    const textX = data.image ? MARGIN + 26 : MARGIN;
    const textWidth = PAGE_WIDTH - MARGIN - textX;
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(9.5);
    const nameLines = this.pdf.splitTextToSize(plain(data.name), textWidth);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8);
    const metaLines = this.pdf.splitTextToSize(plain(`SKU: ${data.sku}  |  ${data.quantity} ${data.unit} × ${data.price}  |  Total: ${data.total}`), textWidth);
    const detailLines = (data.details ?? []).flatMap(line => this.pdf.splitTextToSize(plain(line), textWidth));
    const height = Math.max(data.image ? 25 : 0, nameLines.length * 4.5 + metaLines.length * 4 + detailLines.length * 4 + 7);
    this.ensure(height);
    this.pdf.setDrawColor(218, 224, 229);
    this.pdf.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
    this.y += 4;
    const top = this.y;
    if (data.image) {
      try {
        const image = this.pdf.getImageProperties(data.image);
        const scale = Math.min(22 / image.width, 22 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        this.pdf.addImage(data.image, 'JPEG', MARGIN + (22 - width) / 2, top + (22 - height) / 2, width, height);
      } catch { /* La descripción sigue disponible. */ }
    }
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(9.5);
    this.pdf.text(nameLines, textX, top);
    let textY = top + nameLines.length * 4.5 + 1;
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8);
    this.pdf.text(metaLines, textX, textY);
    textY += metaLines.length * 4 + 1;
    if (detailLines.length) this.pdf.text(detailLines, textX, textY);
    this.y = top + height;
  }

  totals(rows: [string, string][]): void {
    this.section('Resumen');
    for (const [label, value] of rows) {
      this.ensure(6);
      const final = label === 'Total' || label === 'Total a pagar';
      this.pdf.setFont('helvetica', final ? 'bold' : 'normal');
      this.pdf.setFontSize(final ? 11 : 9);
      this.pdf.text(plain(`${label}: ${value}`), PAGE_WIDTH - MARGIN, this.y, { align: 'right' });
      this.y += final ? 7 : 5;
    }
  }

  finish(): Blob {
    const pages = this.pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      this.pdf.setPage(page);
      this.pdf.setDrawColor(218, 224, 229);
      this.pdf.line(MARGIN, PAGE_HEIGHT - 17, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 17);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(105, 118, 128);
      this.pdf.text(plain(`${this.footer}  |  Página ${page} de ${pages}`), PAGE_WIDTH / 2, PAGE_HEIGHT - 12, { align: 'center' });
    }
    return this.pdf.output('blob');
  }
}

