import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DangerZoneComponent } from './danger-zone.component';

describe('DangerZoneComponent (retirement)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const byTestId = (root: ParentNode, id: string): HTMLElement | null =>
    root.querySelector(`[data-testid="${id}"]`);

  async function askAndConfirm() {
    const fixture = TestBed.createComponent(DangerZoneComponent);
    fixture.detectChanges();
    byTestId(fixture.nativeElement, 'retirement-delete-all')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    // nothing is sent before the user confirms
    http.expectNone('/api/retirement');
    const accept = byTestId(document, 'retirement-delete-all-accept');
    expect(accept).not.toBeNull();
    accept?.click();
    fixture.detectChanges();
    return fixture;
  }

  it('deletes via DELETE /retirement only after confirmation', async () => {
    const fixture = await askAndConfirm();
    const req = http.expectOne('/api/retirement');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(byTestId(fixture.nativeElement, 'retirement-delete-all-done')).not.toBeNull();
  });

  it('shows an error when deleting fails', async () => {
    const fixture = await askAndConfirm();
    http.expectOne('/api/retirement').flush({}, { status: 500, statusText: 'err' });
    fixture.detectChanges();
    expect(byTestId(fixture.nativeElement, 'retirement-delete-all-failed')).not.toBeNull();
  });
});
