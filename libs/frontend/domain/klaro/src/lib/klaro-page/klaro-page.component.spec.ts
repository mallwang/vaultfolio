import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KlaroPageComponent } from './klaro-page.component';

describe('KlaroPageComponent', () => {
  let fixture: ComponentFixture<KlaroPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KlaroPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(KlaroPageComponent);
    fixture.detectChanges();
  });

  it('renders (smoke test)', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Klaro');
  });

  // 028-klaro-nav-integration, US2 (FR-004, FR-005): the description and
  // standalone-app statement are both present.
  it('renders the description and the standalone-app banner', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Klaro tracks your contracts and subscriptions');
    expect(text).toContain('its own, separate application');
  });

  // FR-006: the external link opens https://klaro.allwang.family/ in a new
  // tab without disrupting the Vaultfolio session (rel="noopener").
  it('has an external link to https://klaro.allwang.family/ that opens in a new tab', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'a.external-link',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://klaro.allwang.family/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
  });

  // 028-klaro-nav-integration, US3 (FR-007, FR-008, FR-009): all three
  // roadmap statements are present.
  it('renders the future-integration, separate-account, and same-email-sync roadmap statements', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('separate account directly in Klaro');
    expect(text).toContain('identical email address on both your Klaro and Vaultfolio accounts');
    expect(text).toContain('integrated into Vaultfolio under this same nav entry');
  });
});
