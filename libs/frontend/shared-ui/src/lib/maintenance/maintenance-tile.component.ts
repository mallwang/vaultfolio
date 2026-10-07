import { Component, Input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { TranslatePipe } from '../i18n/translate.pipe';

/**
 * Dashboard tile content for a domain in maintenance (041-domain-maintenance-mode). Members get the
 * orange tile text; with `badge` (admins, whose normal tile content stays) only a small marker.
 */
@Component({
  selector: 'app-maintenance-tile',
  imports: [IconComponent, TranslatePipe],
  template: `
    @if (badge) {
      <span class="badge" [attr.data-testid]="testId ?? 'maintenance-tile-badge'">
        <app-icon name="build" />
        {{ 'maintenance.adminBadge' | translate }}
      </span>
    } @else {
      <div class="tile" [attr.data-testid]="testId ?? 'maintenance-tile'">
        <app-icon name="build" class="tile__icon" />
        <strong>{{ 'maintenance.tile.title' | translate }}</strong>
        <p>{{ 'maintenance.tile.body' | translate }}</p>
      </div>
    }
  `,
  styles: `
    .tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      border-radius: 0.5rem;
      text-align: center;
      color: var(--p-orange-700);
      background: color-mix(in srgb, var(--p-orange-500) 12%, transparent);
    }
    .tile__icon {
      font-size: 1.75rem;
    }
    .tile p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.8125rem;
      color: var(--p-orange-700);
      background: color-mix(in srgb, var(--p-orange-500) 15%, transparent);
    }
  `,
})
export class MaintenanceTileComponent {
  // Decorator inputs: workspace-linked libs are externalized in unit tests and not signal-input-compiled.
  @Input() badge = false;
  @Input() testId?: string;
}
