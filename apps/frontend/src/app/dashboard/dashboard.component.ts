import { Component, OnInit, inject, signal } from '@angular/core';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { IconComponent } from '../shared/icon/icon.component';
import { HoldingsDistributionComponent } from '../holdings/holdings-distribution/holdings-distribution.component';
import { HoldingsService } from '../holdings/holdings.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';

/**
 * Dashboard area (FR-005): total value and today's change remain placeholder
 * shells, but the "Allocation" card now shows the holdings value-distribution
 * view (FR-012a in specs/003-manual-holdings-entry), moved here from the
 * Holdings page.
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
