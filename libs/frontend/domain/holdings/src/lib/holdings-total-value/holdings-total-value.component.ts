import { Component } from '@angular/core';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/** Dashboard tile for the combined value of all holdings; still a "coming soon" shell. */
@Component({
  selector: 'app-holdings-total-value',
  imports: [IconComponent, TranslatePipe],
  // Inline template/styles: consumed cross-package, see HoldingsDistributionComponent.
  template: `
    <div class="total-value" data-testid="holdings-total-value">
      <app-icon name="wallet" class="total-value__icon" />
      <span>{{ 'dashboard.comingSoon' | translate }}</span>
      <p>{{ 'dashboard.totalValueBody' | translate }}</p>
    </div>
  `,
  styles: `
    .total-value {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      padding: 0.5rem 0;
      text-align: center;
      color: var(--p-text-muted-color);
    }
    .total-value__icon {
      font-size: 1.5rem;
    }
    .total-value span {
      font-style: italic;
      font-size: 0.85rem;
    }
    .total-value p {
      margin: 0;
      font-size: 0.75rem;
      max-width: 26ch;
    }
  `,
})
export class HoldingsTotalValueComponent {}
