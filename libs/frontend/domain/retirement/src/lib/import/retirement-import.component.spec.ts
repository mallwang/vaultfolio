import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { FakeTextRecogniser, TEXT_RECOGNISER } from '@vaultfolio/frontend-document-reader';
import {
  syntheticPrivateStatement,
  syntheticUnrelatedDocument,
} from '@vaultfolio/retirement/testing';
import { RETIREMENT_FILE_READER } from './import-store';
import { RetirementImportComponent } from './retirement-import.component';

describe('RetirementImportComponent', () => {
  let http: HttpTestingController;
  let text = syntheticPrivateStatement();

  beforeEach(() => {
    text = syntheticPrivateStatement();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'app/retirement/import', component: RetirementImportComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TEXT_RECOGNISER, useValue: new FakeTextRecogniser() },
        {
          provide: RETIREMENT_FILE_READER,
          useValue: { extractPdfText: () => Promise.resolve({ text }) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const byTestId = (el: HTMLElement, id: string): HTMLElement | null =>
    el.querySelector(`[data-testid="${id}"]`);

  async function pick(): Promise<{ el: HTMLElement; harness: RouterTestingHarness }> {
    const harness = await RouterTestingHarness.create('/app/retirement/import');
    const el = harness.routeNativeElement as HTMLElement;
    const input = byTestId(el, 'retirement-import-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [new File(['%PDF'], 'statement.pdf', { type: 'application/pdf' })],
    });
    input.dispatchEvent(new Event('change'));
    return { el, harness };
  }

  it('shows the dropzone with the on-device banner first', async () => {
    const harness = await RouterTestingHarness.create('/app/retirement/import');
    const el = harness.routeNativeElement as HTMLElement;
    expect(byTestId(el, 'retirement-import-dropzone')).not.toBeNull();
    expect(byTestId(el, 'retirement-import-device-banner')).not.toBeNull();
  });

  it('reviews a recognised statement and confirms only after the user does', async () => {
    const { el, harness } = await pick();
    const lookup = await vi.waitFor(() => http.expectOne('/api/retirement/records?pillar=PRIVATE'));
    lookup.flush([]);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(byTestId(el, 'retirement-import-review')).not.toBeNull();
    expect(byTestId(el, 'retirement-import-checks-passed')).not.toBeNull();
    http.expectNone('/api/retirement/records');
    byTestId(el, 'retirement-import-confirm')?.click();
    const post = http.expectOne('/api/retirement/records');
    expect(JSON.stringify(post.request.body)).not.toContain('statement.pdf');
    expect(post.request.body.origin).toBe('IMPORTED');
  });

  it('offers manual entry for a document no parser recognises', async () => {
    text = syntheticUnrelatedDocument();
    const { el, harness } = await pick();
    await vi.waitFor(() => harness.detectChanges());
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(byTestId(el, 'retirement-import-rejected')).not.toBeNull();
    expect(byTestId(el, 'retirement-import-manual')).not.toBeNull();
    http.expectNone((r) => r.method === 'POST');
  });
});
