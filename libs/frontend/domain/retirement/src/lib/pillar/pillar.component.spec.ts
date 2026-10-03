import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { buildRecord } from '@vaultfolio/retirement/testing';
import { PillarComponent } from './pillar.component';

const routes: Routes = [
  { path: 'private', component: PillarComponent, data: { pillar: 'PRIVATE' } },
  { path: 'statutory', component: PillarComponent, data: { pillar: 'STATUTORY' } },
];

describe('PillarComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const byTestId = (el: HTMLElement, id: string): HTMLElement | null =>
    el.querySelector(`[data-testid="${id}"]`);

  async function open(
    url: string,
    records: ReturnType<typeof buildRecord>[],
  ): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create(url);
    http.expectOne((r) => r.url === '/api/retirement/records').flush(records);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  it('shows the empty state and both ways to add the first entry', async () => {
    const el = await open('/private', []);
    expect(byTestId(el, 'retirement-pillar-empty')).not.toBeNull();
    expect(byTestId(el, 'retirement-empty-manual')).not.toBeNull();
    expect(byTestId(el, 'retirement-empty-upload')).not.toBeNull();
  });

  it('lists a card per record', async () => {
    const el = await open('/private', [buildRecord({ id: 'a' }), buildRecord({ id: 'b' })]);
    expect(byTestId(el, 'retirement-pillar-empty')).toBeNull();
    expect(byTestId(el, 'retirement-card-a')).not.toBeNull();
    expect(byTestId(el, 'retirement-card-b')).not.toBeNull();
  });

  it('offers adding a statutory pension only while there is none', async () => {
    const el = await open('/statutory', [
      buildRecord({ id: 's', contractType: 'STATUTORY_PENSION' }),
    ]);
    expect(byTestId(el, 'retirement-pillar-add')).toBeNull();
  });

  it('shows an error when loading fails', async () => {
    const harness = await RouterTestingHarness.create('/private');
    http
      .expectOne((r) => r.url === '/api/retirement/records')
      .flush({ error: 'x' }, { status: 500, statusText: 'Error' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(
      byTestId(harness.routeNativeElement as HTMLElement, 'retirement-pillar-error'),
    ).not.toBeNull();
  });
});
