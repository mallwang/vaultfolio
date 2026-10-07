import { TestBed } from '@angular/core/testing';
import { MaintenanceTileComponent } from './maintenance-tile.component';

describe('MaintenanceTileComponent', () => {
  beforeEach(() => localStorage.clear());

  function render(badge: boolean): HTMLElement {
    const fixture = TestBed.createComponent(MaintenanceTileComponent);
    fixture.componentInstance.badge = badge;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the maintenance text for members', () => {
    const el = render(false);
    expect(el.querySelector('[data-testid="maintenance-tile"]')?.textContent).toContain(
      'Maintenance',
    );
    expect(el.querySelector('[data-testid="maintenance-tile-badge"]')).toBeNull();
  });

  it('renders only the badge for admins', () => {
    const el = render(true);
    expect(el.querySelector('[data-testid="maintenance-tile-badge"]')?.textContent).toContain(
      'not visible to members',
    );
    expect(el.querySelector('[data-testid="maintenance-tile"]')).toBeNull();
  });
});
