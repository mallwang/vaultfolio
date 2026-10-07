import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardTileComponent, TileDetailsDirective } from './dashboard-tile.component';
import { DASHBOARD_TILE_EXPANSION, DashboardTileExpansion } from './dashboard-tile-expansion.token';
import { TileValueComponent } from './tile-value.component';

@Component({
  imports: [DashboardTileComponent, TileDetailsDirective, TileValueComponent],
  template: `
    <app-dashboard-tile
      tileId="demo"
      title="Demo"
      testIdPrefix="demo"
      link="/app/demo"
      linkLabel="Open"
    >
      <app-tile-value>1.000 €</app-tile-value>
      <div tileChart data-testid="chart"></div>
      @if (withDetails()) {
        <div tileDetails data-testid="detail-content">More</div>
      }
    </app-dashboard-tile>
  `,
})
class HostComponent {
  readonly withDetails = signal(true);
}

describe('DashboardTileComponent', () => {
  function render(expansion?: DashboardTileExpansion) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...(expansion ? [{ provide: DASHBOARD_TILE_EXPANSION, useValue: expansion }] : []),
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el };
  }

  const toggle = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('[data-testid="demo-toggle"]');

  it('renders the header, main content and chart zone', () => {
    const { el } = render();
    expect(el.querySelector('.head__title')?.textContent).toBe('Demo');
    expect(el.querySelector('app-tile-value')?.textContent).toContain('1.000 €');
    expect(el.querySelector('[data-testid="chart"]')).not.toBeNull();
  });

  it('keeps details collapsed and unrendered by default', () => {
    const { el } = render();
    expect(toggle(el)?.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[data-testid="detail-content"]')).toBeNull();
  });

  it('expands and collapses with the toggle and flips aria-expanded', () => {
    const { fixture, el } = render();
    toggle(el)?.click();
    fixture.detectChanges();
    expect(toggle(el)?.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('[data-testid="detail-content"]')?.textContent).toBe('More');
    expect(toggle(el)?.getAttribute('aria-controls')).toBe(
      el.querySelector('[data-testid="demo-details"]')?.id,
    );

    toggle(el)?.click();
    fixture.detectChanges();
    expect(toggle(el)?.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[data-testid="detail-content"]')).toBeNull();
  });

  it('has no toggle when no details are provided', () => {
    const { fixture, el } = render();
    fixture.componentInstance.withDetails.set(false);
    fixture.detectChanges();
    expect(toggle(el)).toBeNull();
  });

  it('reads and writes the state through the expansion token', () => {
    const state = signal(false);
    const setExpanded = vi.fn((_id: string, value: boolean) => state.set(value));
    const { fixture, el } = render({ isExpanded: () => state(), setExpanded });

    toggle(el)?.click();
    fixture.detectChanges();

    expect(setExpanded).toHaveBeenCalledWith('demo', true);
    expect(toggle(el)?.getAttribute('aria-expanded')).toBe('true');
  });

  it('starts expanded when the token says so', () => {
    const { el } = render({ isExpanded: () => true, setExpanded: () => undefined });
    expect(toggle(el)?.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('[data-testid="detail-content"]')).not.toBeNull();
  });
});
