import { PDFDocument, PDFFont, PDFImage, PDFPage, RGB, StandardFonts, rgb } from 'pdf-lib';

import { portraitToBytes } from '../characters/portrait';
import { PdfColor, toWinAnsi } from './pdf-text';
import { PdfOp, PdfPage, SheetPdfInput, composeSheetPdf } from './sheet-pdf';

/**
 * Draws the pages composed by sheet-pdf.ts with pdf-lib and the PDF standard fonts (Helvetica:
 * Latin-1 covers Spanish and English; nothing is embedded, so the file stays small). This module
 * is loaded on demand (dynamic import), it is not part of the app's first load.
 */

const COLORS: Record<PdfColor, RGB> = {
  ink: rgb(0.12, 0.12, 0.14),
  muted: rgb(0.45, 0.43, 0.41),
  accent: rgb(0.48, 0.11, 0.13),
  tint: rgb(0.96, 0.93, 0.89),
  white: rgb(1, 1, 1),
  line: rgb(0.23, 0.23, 0.25),
  soft: rgb(0.78, 0.75, 0.71),
};

export async function renderSheetPdf(input: SheetPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const measure = (text: string, size: number, isBold: boolean) =>
    (isBold ? bold : regular).widthOfTextAtSize(toWinAnsi(text), size);

  doc.setTitle(toWinAnsi(input.name));
  doc.setCreator('D&D Helper');
  doc.setProducer('D&D Helper');
  const images = new Map<string, PDFImage | null>();
  for (const spec of composeSheetPdf(input, measure)) {
    for (const op of spec.ops) {
      if (op.k === 'image' && !images.has(op.data)) {
        images.set(op.data, await embedPortrait(doc, op.data));
      }
    }
    const page = doc.addPage([spec.width, spec.height]);
    for (const op of spec.ops) draw(page, spec, op, regular, bold, images);
  }
  return doc.save();
}

/** pdf-lib embeds PNG and JPEG only: a WebP portrait is redrawn as JPEG first. A failure = no image. */
async function embedPortrait(doc: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  try {
    const parsed = portraitToBytes(dataUrl);
    if (!parsed) return null;
    if (parsed.mime === 'image/png') return await doc.embedPng(parsed.bytes);
    if (parsed.mime === 'image/jpeg') return await doc.embedJpg(parsed.bytes);
    const bitmap = await createImageBitmap(
      new Blob([parsed.bytes as BlobPart], { type: parsed.mime }),
    );
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const jpeg = portraitToBytes(canvas.toDataURL('image/jpeg', 0.92));
    return jpeg ? await doc.embedJpg(jpeg.bytes) : null;
  } catch {
    return null;
  }
}

function draw(
  page: PDFPage,
  spec: PdfPage,
  op: PdfOp,
  regular: PDFFont,
  bold: PDFFont,
  images: Map<string, PDFImage | null>,
): void {
  const H = spec.height;
  switch (op.k) {
    case 'rect':
      page.drawSvgPath(roundedRect(op.x, op.y, op.w, op.h, op.r ?? 0), {
        x: 0,
        y: H,
        color: op.fill ? COLORS[op.fill] : undefined,
        borderColor: op.stroke ? COLORS[op.stroke] : undefined,
        borderWidth: op.stroke ? (op.lw ?? 0.8) : 0,
      });
      break;
    case 'line':
      page.drawLine({
        start: { x: op.x1, y: H - op.y1 },
        end: { x: op.x2, y: H - op.y2 },
        thickness: op.lw ?? 0.6,
        color: COLORS[op.color ?? 'line'],
      });
      break;
    case 'circle':
      page.drawCircle({
        x: op.cx,
        y: H - op.cy,
        size: op.r,
        color: op.fill ? COLORS[op.fill] : undefined,
        borderColor: op.stroke ? COLORS[op.stroke] : undefined,
        borderWidth: op.stroke ? (op.lw ?? 0.8) : 0,
      });
      break;
    case 'image': {
      const img = images.get(op.data);
      if (img) page.drawImage(img, { x: op.x, y: H - op.y - op.h, width: op.w, height: op.h });
      break;
    }
    case 'half':
      page.drawSvgPath(
        `M ${op.cx} ${op.cy - op.r} A ${op.r} ${op.r} 0 0 0 ${op.cx} ${op.cy + op.r} Z`,
        {
          x: 0,
          y: H,
          color: COLORS[op.fill],
        },
      );
      break;
    case 'diamond': {
      const { cx, cy, r } = op;
      page.drawSvgPath(
        `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`,
        {
          x: 0,
          y: H,
          color: op.filled ? COLORS[op.color ?? 'line'] : COLORS.white,
          borderColor: COLORS[op.color ?? 'line'],
          borderWidth: 0.8,
        },
      );
      break;
    }
    case 'text': {
      const font = op.bold ? bold : regular;
      const width = font.widthOfTextAtSize(op.text, op.size);
      const x =
        op.align === 'center' ? op.x - width / 2 : op.align === 'right' ? op.x - width : op.x;
      page.drawText(op.text, {
        x,
        y: H - op.y,
        size: op.size,
        font,
        color: COLORS[op.color ?? 'ink'],
      });
      break;
    }
  }
}

/** An SVG path of a rectangle with rounded corners (y down, as drawSvgPath wants it). */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const q = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + q} ${y}`,
    `H ${x + w - q}`,
    `A ${q} ${q} 0 0 1 ${x + w} ${y + q}`,
    `V ${y + h - q}`,
    `A ${q} ${q} 0 0 1 ${x + w - q} ${y + h}`,
    `H ${x + q}`,
    `A ${q} ${q} 0 0 1 ${x} ${y + h - q}`,
    `V ${y + q}`,
    `A ${q} ${q} 0 0 1 ${x + q} ${y}`,
    'Z',
  ].join(' ');
}
