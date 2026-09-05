import { Component, OnInit, inject, signal } from '@angular/core';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
/* eslint-disable-next-line @nx/enforce-module-boundaries -- HoldingsDistributionComponent is used
   exclusively inside the template's @defer block below (never in `imports` eagerly), so Angular's
   own compiler emits a dynamic import for it, decoupled from app.routes.ts's dynamic import of the
   same package — see the class doc comment. */
import {
  HoldingsService,
  HoldingsDistributionComponent,
} from '@vaultfolio/frontend-domain-holdings';

/**
 * Dashboard area (FR-005): total value and today's change remain placeholder
 * shells, but the "Allocation" card now shows the holdings value-distribution
 * view (FR-012a in specs/003-manual-holdings-entry), moved here from the
 * Holdings page.
 *
 * `HoldingsDistributionComponent` is used only inside the template's
 * `@defer` block, so Angular compiles it into its own dynamic `import()`,
 * decoupled from the `/app/holdings` route's dynamic import of the same
 * package. Without that, a component used both eagerly here and dynamically
 * there would force the whole `@vaultfolio/frontend-domain-holdings` module
 * — including the Holdings page's PrimeNG-heavy form/table — into the
 * eagerly-loaded initial bundle (020, FR-010's "single deployable bundle"
 * constraint; discovered as a budget regression while retrofitting holdings
 * behind its own library).
 */
@Component({
  selector: 'app-dashboard',
  imports: [CardModule, TagModule, TranslatePipe, IconComponent, HoldingsDistributionComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly holdingsService = inject(HoldingsService);

  protected readonly holdings = signal<HoldingResponse[]>([]);

  ngOnInit(): void {
    this.holdingsService.list().subscribe({
      next: (holdings) => this.holdings.set(holdings),
      // Allocation card falls back to its own empty state on load failure —
      // total value/today's change cards are unaffected (still placeholders).
      error: () => this.holdings.set([]),
    });
  }
}
