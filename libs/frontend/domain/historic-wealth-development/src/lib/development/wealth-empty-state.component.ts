import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/** Empty state (design.md "Leer"): short explanation and the call to action. */
@Component({
  selector: 'app-wealth-empty-state',
  imports: [RouterLink, ButtonModule, IconComponent, TranslatePipe],
  template: `
    <div class="empty" data-testid="wealth-empty">
      <span class="icon"><app-icon name="trending-up" /></span>
      <h2>{{ 'wealth.empty.title' | translate }}</h2>
      <p>{{ 'wealth.empty.body' | translate }}</p>
      <a pButton routerLink="/app/historic-wealth-development/new" data-testid="wealth-empty-cta">
        <app-icon name="plus" /> {{ 'wealth.empty.cta' | translate }}
      </a>
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.5rem;
      max-width: 34rem;
      margin: 2.5rem auto;
    }
    .icon {
      display: inline-flex;
      padding: 0.875rem;
      border-radius: 50%;
      color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 14%, transparent);
      font-size: 1.5rem;
    }
    h2 {
      margin: 0.5rem 0 0;
      font-size: 1.2rem;
    }
    p {
      margin: 0 0 0.75rem;
      color: var(--p-text-muted-color);
    }
    a.p-button {
      text-decoration: none;
    }
  `,
})
export class WealthEmptyStateComponent {}
