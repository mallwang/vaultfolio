import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

/**
 * Empty state of a dashboard tile: the whole tile is one call to action. The `empty` class is the
 * hook the dashboard uses to tint the surrounding card on hover.
 */
@Component({
  selector: 'app-empty-tile',
  imports: [RouterLink, IconComponent],
  template: `
    <a class="empty" [routerLink]="link" [attr.data-testid]="testId">
      <strong>{{ title }}</strong>
      <span class="muted">{{ body }}</span>
      <span class="cta">
        <span class="cta__label">{{ ctaLabel }}</span>
        <app-icon name="chevron-right" />
      </span>
    </a>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      color: inherit;
      text-decoration: none;
    }
    .empty:focus-visible {
      outline: 2px solid var(--p-primary-color);
      outline-offset: 2px;
      border-radius: 0.375rem;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .cta {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-primary-color);
      font-size: 0.875rem;
    }
    .cta app-icon {
      transition: transform 0.15s;
    }
    .empty:hover .cta__label {
      text-decoration: underline;
    }
    .empty:hover .cta app-icon {
      transform: translateX(0.25rem);
    }
  `,
})
export class EmptyTileComponent {
  // Decorator inputs: workspace-linked libs are externalized in unit tests and not signal-input-compiled.
  @Input({ required: true }) title = '';
  @Input({ required: true }) body = '';
  @Input({ required: true }) ctaLabel = '';
  @Input({ required: true }) link = '';
  @Input() testId?: string;
}
