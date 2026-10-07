import { TestBed } from '@angular/core/testing';
import { MaintenanceNoticeComponent } from './maintenance-notice.component';

describe('MaintenanceNoticeComponent', () => {
  beforeEach(() => localStorage.clear());

  function render(mode?: 'page' | 'banner', testId?: string): HTMLElement {
    const fixture = TestBed.createComponent(MaintenanceNoticeComponent);
    if (mode) fixture.componentInstance.mode = mode;
    fixture.componentInstance.testId = testId;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the centered page notice by default', () => {
    const el = render();
    const notice = el.querySelector('[data-testid="maintenance-notice"]');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain('Temporarily unavailable');
    expect(el.querySelector('[data-testid="maintenance-banner"]')).toBeNull();
  });

  it('renders the slim admin banner in banner mode', () => {
    const el = render('banner');
    expect(el.querySelector('[data-testid="maintenance-banner"]')?.textContent).toContain(
      'in maintenance',
    );
    expect(el.querySelector('[data-testid="maintenance-notice"]')).toBeNull();
  });

  it('honours a custom test id', () => {
    expect(render('page', 'custom').querySelector('[data-testid="custom"]')).not.toBeNull();
  });
});
