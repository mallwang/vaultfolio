import { TestBed } from '@angular/core/testing';
import { loadPdfLogo, PDF_LOGO } from './pdf-logo';

/** The test DOM's FileReader rejects Node Blobs, so the reader is faked. */
function stubFileReader(outcome: 'load' | 'error') {
  class FakeReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL() {
      if (outcome === 'load') {
        this.result = 'data:image/png;base64,cG5n';
        this.onload?.();
      } else {
        this.onerror?.();
      }
    }
  }
  vi.stubGlobal('FileReader', FakeReader);
}

describe('loadPdfLogo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the logo as a data URL', async () => {
    stubFileReader('load');
    const blob = new Blob(['png'], { type: 'image/png' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) }),
    );

    const logo = await loadPdfLogo();

    expect(logo).toBe('data:image/png;base64,cG5n');
  });

  it('returns undefined when the logo cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    expect(await loadPdfLogo()).toBeUndefined();
  });

  it('returns undefined when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    expect(await loadPdfLogo()).toBeUndefined();
  });

  it('returns undefined when the file cannot be read', async () => {
    stubFileReader('error');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) }),
    );

    expect(await loadPdfLogo()).toBeUndefined();
  });

  it('is provided by default through the PDF_LOGO token', () => {
    expect(TestBed.inject(PDF_LOGO)).toBe(loadPdfLogo);
  });
});
