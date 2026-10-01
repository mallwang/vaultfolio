import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { textDocument } from '@vaultfolio/earnings';
import { SAP_AUG_2026, SAP_AUG_2026_NET_OFF, UNRELATED_PAGES } from '@vaultfolio/earnings/testing';
import { ParserRequestStore } from '../parser-request/parser-request.store';
import { EarningsImportComponent } from './earnings-import.component';
import { EARNINGS_FILE_READER } from './import-session.store';

const PAGES: Record<string, string[][]> = {
  'unknown.pdf': UNRELATED_PAGES,
  [SAP_AUG_2026.fileName]: SAP_AUG_2026.pages,
  [SAP_AUG_2026_NET_OFF.fileName]: SAP_AUG_2026_NET_OFF.pages,
};

describe('Request a parser button on the import page (033 FR-001)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: EARNINGS_FILE_READER,
          useValue: {
            extractPdfText: async (file: File) => {
              if (file.name === 'scan.pdf') return { error: 'IMAGE_ONLY' };
              if (file.name === 'locked.pdf') return { error: 'PASSWORD_PROTECTED' };
              return { text: textDocument(PAGES[file.name]) };
            },
            sha256Hex: async (file: File) => file.name.length.toString(16).padStart(64, '0'),
          },
        },
      ],
    });
  });

  async function drop(names: string[]) {
    const fixture = TestBed.createComponent(EarningsImportComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('[data-testid="earnings-import-input"]') as HTMLInputElement;
    const files = names.map((n) => new File(['%PDF'], n, { type: 'application/pdf' }));
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    return { fixture, root };
  }

  const buttons = (root: HTMLElement) => [
    ...root.querySelectorAll('[data-testid^="request-parser-button-"]'),
  ];

  it('is offered only for the unknown layout of a text PDF', async () => {
    const { root } = await drop([
      'unknown.pdf',
      SAP_AUG_2026.fileName,
      SAP_AUG_2026_NET_OFF.fileName,
      'scan.pdf',
      'locked.pdf',
    ]);
    expect(root.querySelectorAll('[data-testid^="earnings-import-row-"]')).toHaveLength(5);
    expect(buttons(root)).toHaveLength(1);
    const row = buttons(root)[0].closest('[data-testid^="earnings-import-row-"]') as HTMLElement;
    expect(row.textContent).toContain('unknown.pdf');
    expect(row.textContent).toContain('Request a parser');
    expect(row.textContent).toContain('anonymized copy');
  });

  it('hands the file to the wizard and opens it', async () => {
    const { root } = await drop(['unknown.pdf']);
    const store = TestBed.inject(ParserRequestStore);
    const open = vi.spyOn(store, 'open').mockResolvedValue();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (buttons(root)[0] as HTMLButtonElement).click();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ name: 'unknown.pdf' }));
    expect(navigate).toHaveBeenCalledWith(['/app/earnings/import/request']);
  });
});
