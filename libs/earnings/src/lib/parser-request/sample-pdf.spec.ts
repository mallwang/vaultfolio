import { renderSamplePdf } from './sample-pdf.js';
import type { Sheet } from './sheet.js';

const latin1 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('latin1');

function sheet(items: Sheet['pages'][number]['items'], pages = 1): Sheet {
  return {
    pages: Array.from({ length: pages }, () => ({ width: 595.3, height: 841.9, items })),
  };
}

/** The `( … )` literal of every `Tj` operator, escapes resolved, plus the PDF with those literals emptied. */
function literals(pdf: string): { texts: string[]; structure: string } {
  const texts: string[] = [];
  let structure = '';
  let i = 0;
  while (i < pdf.length) {
    const isShow =
      pdf[i] === '(' &&
      /^\(.*\) Tj/s.test(pdf.slice(i, i + 5000)) &&
      /Tm $/.test(pdf.slice(Math.max(0, i - 4), i));
    if (!isShow) {
      structure += pdf[i];
      i += 1;
      continue;
    }
    let text = '';
    i += 1;
    while (pdf[i] !== ')') {
      if (pdf[i] === '\\') i += 1;
      text += pdf[i];
      i += 1;
    }
    i += 1;
    texts.push(text);
    structure += '()';
  }
  return { texts, structure };
}

const shownTexts = (pdf: string): string[] => literals(pdf).texts;

describe('renderSamplePdf', () => {
  const items = [
    { text: 'Brutto', x: 56.7, y: 96, size: 9 },
    { text: '3.842,17', x: 391.4, y: 96, size: 9 },
  ];

  it('writes a well-formed single-page PDF with exact positions', () => {
    const pdf = latin1(renderSamplePdf(sheet(items)));
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.endsWith('%%EOF\n')).toBe(true);
    expect(pdf).toContain('/MediaBox [0 0 595.3 841.9]');
    expect(pdf).toContain('/BaseFont /Courier');
    expect(pdf).toContain('/Encoding /WinAnsiEncoding');
    expect(pdf).toContain('BT /F1 9 Tf 1 0 0 1 56.7 745.9 Tm (Brutto) Tj ET');
    expect(pdf).toContain('BT /F1 9 Tf 1 0 0 1 391.4 745.9 Tm (3.842,17) Tj ET');
    expect(pdf).toContain('/Count 1');
  });

  it('writes one page and content object per sheet page', () => {
    const pdf = latin1(renderSamplePdf(sheet(items, 3)));
    expect(pdf).toContain('/Count 3');
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(3);
    expect(pdf).toContain('/Kids [4 0 R 6 0 R 8 0 R]');
  });

  it('has a valid xref table whose offsets point at the objects', () => {
    const pdf = latin1(renderSamplePdf(sheet(items, 2)));
    const xrefAt = Number(/startxref\n(\d+)\n/.exec(pdf)?.[1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const entries = [...pdf.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    expect(entries).toHaveLength(7);
    entries.forEach((offset, i) => {
      expect(pdf.slice(offset).startsWith(`${i + 1} 0 obj\n`)).toBe(true);
    });
    expect(pdf).toContain('/Size 8');
  });

  it('declares the exact stream length', () => {
    const pdf = latin1(renderSamplePdf(sheet(items)));
    const length = Number(/\/Length (\d+) >>\nstream\n/.exec(pdf)?.[1]);
    const stream = /stream\n([\s\S]*?)\nendstream/.exec(pdf)?.[1] as string;
    expect(stream).toHaveLength(length);
  });

  it('is deterministic for a given sheet', () => {
    expect(Buffer.from(renderSamplePdf(sheet(items)))).toEqual(
      Buffer.from(renderSamplePdf(sheet(items))),
    );
  });

  it('contains none of the names that could make a PDF do anything but show text', () => {
    const pdf = latin1(
      renderSamplePdf(sheet([{ text: '/JavaScript(/URI)/Launch', x: 1, y: 1, size: 9 }], 2)),
    );
    // the literal text above is data inside a string, which is escaped — strip all strings first
    const { structure } = literals(pdf);
    for (const name of [
      '/JavaScript',
      '/JS',
      '/Launch',
      '/URI',
      '/EmbeddedFile',
      '/AcroForm',
      '/OpenAction',
      '/AA',
      '/Annots',
      '/Action',
      '/Names',
      '/Info',
    ]) {
      expect(structure).not.toContain(name);
    }
  });

  describe('text', () => {
    it('escapes backslash and parentheses', () => {
      const pdf = latin1(renderSamplePdf(sheet([{ text: 'a(b)c\\d', x: 1, y: 1, size: 9 }])));
      expect(pdf).toContain('(a\\(b\\)c\\\\d) Tj');
      expect(shownTexts(pdf)).toEqual(['a(b)c\\d']);
    });

    it('maps WinAnsi: Latin-1 as is, € as 0x80, everything else to ?', () => {
      const bytes = renderSamplePdf(sheet([{ text: 'Größe €5 ß😀·', x: 1, y: 1, size: 9 }]));
      const pdf = latin1(bytes);
      expect(shownTexts(pdf)).toEqual(['Größe \u00805 ß?·']);
      expect(bytes.includes(0x80)).toBe(true);
      expect(Math.max(...bytes)).toBeLessThanOrEqual(0xff);
    });

    it('replaces characters outside WinAnsi with ?', () => {
      const pdf = latin1(renderSamplePdf(sheet([{ text: 'a中b\u0007', x: 1, y: 1, size: 9 }])));
      expect(shownTexts(pdf)).toEqual(['a?b?']);
    });
  });

  it('stays below 512 kB for the maximum layout (3 000 words of 60 characters)', () => {
    const maximum: Sheet = {
      pages: Array.from({ length: 3 }, () => ({
        width: 595.3,
        height: 841.9,
        items: Array.from({ length: 1000 }, (_v, i) => ({
          text: 'x'.repeat(60),
          x: 100.55,
          y: 6 + (i % 120) * 6.55,
          size: 9,
        })),
      })),
    };
    expect(renderSamplePdf(maximum).byteLength).toBeLessThan(512 * 1024);
  });
});
