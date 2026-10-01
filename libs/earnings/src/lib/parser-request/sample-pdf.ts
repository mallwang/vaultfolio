import type { Sheet } from './sheet.js';

/**
 * Minimal text-only PDF writer (R2). It can only emit a catalog, a page tree, one standard Courier
 * font (Type1, WinAnsi, not embedded) and per page a content stream of `BT … Tj … ET` operators —
 * no actions, links, scripts, attachments, forms, annotations or metadata, by construction. The
 * output is deterministic for a given sheet (no dates, no ids).
 */

const WIN_ANSI_EURO = 0x80;

/** One byte per character: printable ASCII and Latin-1 as is, `€` as 0x80, anything else `?`. */
function toWinAnsiByte(codePoint: number): number {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return codePoint;
  if (codePoint >= 0xa0 && codePoint <= 0xff) return codePoint;
  if (codePoint === 0x20ac) return WIN_ANSI_EURO;
  return 0x3f;
}

/** A PDF literal string body: WinAnsi bytes with `\`, `(` and `)` escaped, as a Latin-1 string. */
function escapeText(text: string): string {
  let out = '';
  for (const char of text) {
    const code = toWinAnsiByte(char.codePointAt(0) as number);
    const byte = String.fromCodePoint(code);
    out += byte === '\\' || byte === '(' || byte === ')' ? `\\${byte}` : byte;
  }
  return out;
}

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function contentStream(page: Sheet['pages'][number]): string {
  return page.items
    .map(
      (item) =>
        `BT /F1 ${number(item.size)} Tf 1 0 0 1 ${number(item.x)} ${number(page.height - item.y)} Tm (${escapeText(item.text)}) Tj ET`,
    )
    .join('\n');
}

function toBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = (text.codePointAt(i) as number) & 0xff;
  return bytes;
}

export function renderSamplePdf(sheet: Sheet): Uint8Array {
  // object numbers: 1 catalog, 2 page tree, 3 font, then (page, content) pairs
  const pageCount = sheet.pages.length;
  const pageObject = (index: number): number => 4 + index * 2;
  const kids = sheet.pages.map((_page, i) => `${pageObject(i)} 0 R`).join(' ');

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
  ];
  sheet.pages.forEach((page, i) => {
    const stream = contentStream(page);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(page.width)} ${number(page.height)}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${pageObject(i) + 1} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });

  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return toBytes(out);
}
