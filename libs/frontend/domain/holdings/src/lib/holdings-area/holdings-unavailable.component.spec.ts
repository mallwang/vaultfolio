import { TestBed } from '@angular/core/testing';
import { HoldingsUnavailableComponent } from './holdings-unavailable.component';

describe('HoldingsUnavailableComponent', () => {
  it('renders the alert with its test id', () => {
    const fixture = TestBed.createComponent(HoldingsUnavailableComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="holdings-unavailable"]')?.getAttribute('role')).toBe(
      'alert',
    );
  });
});
