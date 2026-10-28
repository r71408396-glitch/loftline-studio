// Renders a build sheet as an A4 PDF for the workshop: what to cut, which
// powder coat, what goes in which box, and the quality checks to sign off.
import PDFDocument from 'pdfkit';
import type { BuildSheet } from './builds';

const INK = '#0b1220';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const ACCENT = '#4f46e5';

export function renderBuildSheetPdf(sheet: BuildSheet, shopName = 'Loftline Studio'): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Build sheet ${sheet.buildNumber}`, Author: shopName } });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  // Header
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9).text(shopName.toUpperCase(), left, 48, { characterSpacing: 1 });
  doc.fillColor(INK).fontSize(22).text(`Build sheet ${sheet.buildNumber}`, left, 64);
  doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(`Order ${sheet.orderName}   ·   Quantity ${sheet.quantity}`, left, 92);
  rule(doc, 112);

  let y = 128;
  const heading = (text: string) => {
    if (y > doc.page.height - 140) {
      doc.addPage();
      y = 48;
    }
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(text, left, y);
    y += 20;
  };
  const row = (label: string, value: string) => {
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(label, left, y, { width: 150 });
    doc.fillColor(INK).text(value, left + 160, y, { width: width - 160 });
    y = Math.max(doc.y, y + 14) + 6;
  };

  if (sheet.problems.length) {
    doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(10).text(sheet.problems.join('  '), left, y, { width });
    y = doc.y + 12;
  }

  if (sheet.top) {
    heading('1. Desk top');
    row('Material', `${sheet.top.material} (${sheet.top.core})`);
    row('Finished size', `${sheet.top.finishedSizeMm} mm`);
    row('Edge', sheet.top.edge);
    row('Corner radius', `${sheet.top.cornerRadiusMm} mm`);
    row('SKU', sheet.top.sku);
    row('Weight', `${sheet.top.weightKg} kg`);
    y += 8;
  }

  if (sheet.frame) {
    heading('2. Frame');
    row('Colour', sheet.frame.colour);
    row('Powder coat', sheet.frame.ral);
    row('Leg spacing', `${sheet.frame.legSpacingMm} mm (centre to centre)`);
    row('Cross beam', `Set to ${sheet.frame.crossBeamMm} mm`);
    row('SKU', sheet.frame.sku);
    y += 8;
  }

  if (sheet.accessories.length) {
    heading('3. Accessories');
    for (const a of sheet.accessories) row(`${a.quantity} x`, `${a.name}  (${a.sku})`);
    y += 8;
  }

  heading('Packing list');
  for (const box of sheet.packing) {
    row(`Box ${box.box}`, `${box.contents}${box.weightKg ? `   ·   about ${box.weightKg} kg` : ''}`);
  }
  y += 8;

  heading('Quality check');
  for (const check of sheet.checks) {
    doc.rect(left, y + 1, 9, 9).strokeColor(MUTED).lineWidth(0.8).stroke();
    doc.fillColor(INK).font('Helvetica').fontSize(10).text(check, left + 18, y, { width: width - 18 });
    y = doc.y + 6;
  }

  y += 18;
  doc.fillColor(MUTED).fontSize(9).text('Checked by ____________________     Date ____________', left, y);

  doc.end();
  return done;
}

function rule(doc: PDFKit.PDFDocument, y: number) {
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor(LINE).lineWidth(1).stroke();
}
