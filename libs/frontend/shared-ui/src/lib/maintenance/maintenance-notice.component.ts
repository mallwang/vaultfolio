import { Component, Input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { TranslatePipe } from '../i18n/translate.pipe';

/**
 * Orange maintenance notice (041-domain-maintenance-mode). `page` is the centered replacement for a
 * domain's content (members); `banner` is the slim strip above the content (admins).
 */
@Component({
  selector: 'app-maintenance-notice',
  imports: [IconComponent, TranslatePipe],
  template: `
    @if (mode === 'banner') {
      <div class="banner" role="status" [attr.data-testid]="testId ?? 'maintenance-banner'">
        <app-icon name="build" />
        <span>{{ 'maintenance.adminBanner' | translate }}</span>
      </div>
    } @else {
      <section class="page" role="status" [attr.data-testid]="testId ?? 'maintenance-notice'">
        <span class="page__icon"><app-icon name="build" /></span>
        <h2>{{ 'maintenance.notice.title' | translate }}</h2>
        <p>{{ 'maintenance.notice.body' | translate }}</p>
      </section>
    }
  `,
  styles: `
    .page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      min-height: 50vh;
      text-align: center;
      padding: 2rem 1rem;
    }
    .page h2 {
      margin: 0;
      color: var(--p-orange-600);
    }
    .page p {
      margin: 0;
      max-width: 32rem;
      color: var(--p-text-muted-color);
    }
    .page__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 4rem;
      height: 4rem;
      border-radius: 50%;
      color: var(--p-orange-600);
      background: color-mix(in srgb, var(--p-orange-500) 15%, transparent);
      font-size: 2rem;
    }
    .banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--p-orange-400);
      border-radius: 0.5rem;
      color: var(--p-orange-700);
      background: color-mix(in srgb, var(--p-orange-500) 12%, transparent);
    }
  `,
})
export class MaintenanceNoticeComponent {
  // Decorator inputs: workspace-linked libs are externalized in unit tests and not signal-input-compiled.
  @Input() mode: 'page' | 'banner' = 'page';
  @Input() testId?: string;
}
