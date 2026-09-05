import { Component, Input, OnChanges, Type, signal } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';

/**
 * Generic "await a loader, render the resolved component" host
 * (research.md #3, contracts/dashboard-settings-extension-points.md). Every
 * Dashboard widget contribution — and any other extension point that needs
 * to render a dynamically-imported component without an eager import —
 * renders through one `<app-dynamic-outlet [loader]="c.loadComponent" />`.
 *
 * This generalizes the one-off `@defer` block `DashboardComponent` used to
 * hand-write for the holdings distribution widget: the loader is awaited
 * once, and nothing renders until it resolves — so the eagerly-loaded
 * initial bundle never pulls in the target component's own package (FR-010
 * of 020, "single deployable bundle", still binding).
 *
 * `loader` is a decorator `@Input` read from `ngOnChanges`, the same
 * convention `HoldingsDistributionComponent` already uses for its own
 * `[holdings]` input, rather than a signal `input.required()`.
 */
@Component({
  selector: 'app-dynamic-outlet',
  imports: [NgComponentOutlet],
  template: `@if (type(); as t) {
    <ng-container [ngComponentOutlet]="t" />
  }`,
})
export class DynamicOutletComponent implements OnChanges {
  @Input({ required: true }) loader!: () => Promise<Type<unknown>>;

  protected readonly type = signal<Type<unknown> | null>(null);

  ngOnChanges(): void {
    this.loader().then((resolved) => this.type.set(resolved));
  }
}
