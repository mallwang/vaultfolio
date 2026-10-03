import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RETIREMENT_RESOURCES } from '@vaultfolio/retirement';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { RetirementInfoComponent } from './retirement-info.component';

describe('RetirementInfoComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  afterEach(() => TestBed.inject(I18nService).setLanguage('en'));

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(RetirementInfoComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders one card per resource with category, description, source and link', () => {
    const el = render();
    const cards = el.querySelectorAll('article.card');
    expect(cards).toHaveLength(3);
    const text = el.textContent ?? '';
    expect(text).toContain('The three pillars of retirement provision');
    expect(text).toContain('Pension gap calculator');
    expect(text).toContain('Source: Finanztip');
    expect(text).toContain('Calculator');
  });

  it('opens every link in a new tab without opener or referrer and with the exact URL', () => {
    const el = render();
    for (const resource of RETIREMENT_RESOURCES) {
      const link = el.querySelector<HTMLAnchorElement>(
        `[data-testid="retirement-info-link-${resource.id}"]`,
      );
      expect(link?.getAttribute('href')).toBe(resource.url);
      expect(link?.target).toBe('_blank');
      expect(link?.rel).toBe('noopener noreferrer');
    }
  });

  it('includes the privacy note below the cards', () => {
    expect(render().querySelector('[data-testid="retirement-privacy-note"]')).not.toBeNull();
  });

  it('renders in German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const text = render().textContent ?? '';
    expect(text).toContain('Rentenlückenrechner');
    expect(text).toContain('Quelle: Finanzfluss');
  });
});
