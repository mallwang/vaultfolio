import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/**
 * Historic Wealth Development placeholder page
 * (022-add-domain-placeholders, FR-003): names the domain and states its
 * functionality isn't built yet — no inputs, no backend call
 * (contracts/domain-placeholder-library.md "Component contract"). Mirrors
 * `ImportsComponent`'s existing empty-state card shape (research.md #4).
 *
 * Inline template/styles, not templateUrl/styleUrl (020, 021): this
 * component is lazy-loaded cross-package by `apps/frontend/src/app.routes.ts`,
 * and `@angular/build:unit-test` externalizes every workspace-linked package
 * during its build step, skipping Angular's own resource-inlining there —
 * see `IconComponent`'s identical note in `@vaultfolio/frontend-shared-ui`.
 */
@Component({
  selector: 'app-historic-wealth-development-placeholder',
  imports: [CardModule, TranslatePipe],
  template: `
    <p-card>
      <div class="placeholder">
        <strong>{{ 'historicWealthDevelopmentPlaceholder.title' | translate }}</strong>
        <p>{{ 'historicWealthDevelopmentPlaceholder.body' | translate }}</p>
      </div>
    </p-card>
  `,
  styles: `
    :host {
      display: block;
      max-width: 640px;
      margin: 0 auto;
    }

    .placeholder {
      padding: 2.25rem 1.5rem;
      text-align: center;
      color: var(--p-text-muted-color);
    }

    .placeholder strong {
      color: var(--p-text-color);
      display: block;
      margin-bottom: 0.25rem;
      font-size: 0.92rem;
    }

    .placeholder p {
      margin: 0;
      font-size: 0.82rem;
    }
  `,
})
export class HistoricWealthDevelopmentPlaceholderComponent {}
