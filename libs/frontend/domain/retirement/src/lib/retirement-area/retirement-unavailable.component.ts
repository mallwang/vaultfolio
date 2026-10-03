import { Component } from '@angular/core';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/** Key-unavailable state: no figures, no import — the stored data is not lost. */
@Component({
  selector: 'app-retirement-unavailable',
  imports: [IconComponent, TranslatePipe],
  template: `
    <div class="unavailable" role="alert" data-testid="retirement-unavailable">
      <span class="icon"><app-icon name="lock" /></span>
      <h2>{{ 'retirement.unavailable.title' | translate }}</h2>
      <p>{{ 'retirement.unavailable.body' | translate }}</p>
    </div>
  `,
  styles: `
    .unavailable {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.5rem;
      max-width: 36rem;
      margin: 3rem auto;
    }
    .icon {
      display: inline-flex;
      padding: 0.875rem;
      border-radius: 50%;
      color: var(--p-red-600);
      background: color-mix(in srgb, var(--p-red-500) 14%, transparent);
      font-size: 1.5rem;
    }
    h2 {
      margin: 0.5rem 0 0;
      font-size: 1.2rem;
    }
    p {
      margin: 0;
      color: var(--p-text-muted-color);
    }
  `,
})
export class RetirementUnavailableComponent {}
