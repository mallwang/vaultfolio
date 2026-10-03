import { Component } from '@angular/core';
import { RETIREMENT_RESOURCES } from '@vaultfolio/retirement';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { DangerZoneComponent } from '../danger-zone/danger-zone.component';

/**
 * "Weiterführende Informationen" tab (Story 4, FR-012): one card per external resource with a
 * category badge, description, source and a plain link that opens in a new tab and carries no
 * user data. The "delete all" danger zone (FR-015) sits below; the privacy note (FR-016) is a
 * modal opened from the toolbar.
 */
@Component({
  selector: 'app-retirement-info',
  imports: [IconComponent, TranslatePipe, DangerZoneComponent],
  template: `
    <section class="info" data-testid="retirement-info">
      <p class="intro">{{ 'retirement.info.intro' | translate }}</p>
      <div class="cards">
        @for (resource of resources; track resource.id) {
          <article class="card" [attr.data-testid]="'retirement-info-card-' + resource.id">
            <span class="badge">{{ resource.categoryKey | translate }}</span>
            <h3>{{ resource.titleKey | translate }}</h3>
            <p class="description">{{ resource.descriptionKey | translate }}</p>
            <p class="source">
              {{ 'retirement.info.sourceLabel' | translate }}: {{ resource.sourceKey | translate }}
            </p>
            <a
              class="link"
              [href]="resource.url"
              target="_blank"
              rel="noopener noreferrer"
              [attr.data-testid]="'retirement-info-link-' + resource.id"
              [attr.aria-label]="
                (resource.titleKey | translate) +
                ' – ' +
                ('retirement.info.opensInNewTab' | translate)
              "
            >
              {{ 'retirement.info.open' | translate }} <app-icon name="external-link" />
            </a>
          </article>
        }
      </div>
      <app-retirement-danger-zone />
    </section>
  `,
  styles: `
    .info {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .intro {
      margin: 0;
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
      gap: 0.75rem;
    }
    .card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    .badge {
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
    }
    h3 {
      margin: 0;
      font-size: 1rem;
    }
    .description {
      margin: 0;
      font-size: 0.875rem;
    }
    .source {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
    /* The glyph lives in app-icon's own encapsulated template, so sizing it needs ng-deep. */
    .link ::ng-deep .material-symbols-outlined {
      font-size: 1rem;
    }
    .link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      margin-top: auto;
      color: var(--p-primary-color);
      text-decoration: none;
      font-size: 0.875rem;
    }
  `,
})
export class RetirementInfoComponent {
  protected readonly resources = RETIREMENT_RESOURCES;
}
