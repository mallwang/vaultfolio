import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/**
 * Empty state shared by the overview and the three pillar tabs: icon, title, text and the two ways
 * to add a first entry (upload, manual). `from` is handed to those screens so their "Back" returns
 * to the tab they were opened from.
 */
@Component({
  selector: 'app-retirement-empty-state',
  imports: [RouterLink, ButtonModule, IconComponent, TranslatePipe],
  template: `
    <div class="empty" [attr.data-testid]="testId()">
      <span class="icon"><app-icon name="elderly" /></span>
      <h2>{{ titleKey() | translate }}</h2>
      <p>{{ bodyKey() | translate }}</p>
      <div class="actions">
        <a
          pButton
          routerLink="/app/retirement/import"
          [queryParams]="queryParams()"
          data-testid="retirement-empty-upload"
        >
          <app-icon name="upload" /> {{ 'retirement.toolbar.upload' | translate }}
        </a>
        <a
          pButton
          severity="secondary"
          [outlined]="true"
          [routerLink]="manualLink()"
          [queryParams]="queryParams()"
          data-testid="retirement-empty-manual"
        >
          <app-icon name="plus" /> {{ 'retirement.toolbar.manual' | translate }}
        </a>
      </div>
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.75rem;
      max-width: 36rem;
      margin: 2rem auto;
    }
    .icon {
      display: inline-flex;
      padding: 0.875rem;
      border-radius: 50%;
      color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
      font-size: 1.5rem;
    }
    h2 {
      margin: 0;
      font-size: 1.2rem;
    }
    p {
      margin: 0;
      color: var(--p-text-muted-color);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
    }
    a.p-button {
      text-decoration: none;
    }
  `,
})
export class EmptyStateComponent {
  readonly titleKey = input.required<string>();
  readonly bodyKey = input.required<string>();
  readonly testId = input.required<string>();
  readonly manualLink = input<string[]>(['/app/retirement/new']);
  readonly from = input<string | null>(null);

  protected queryParams(): Record<string, string> {
    const from = this.from();
    return from ? { from } : {};
  }
}
