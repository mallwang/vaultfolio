import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/**
 * Klaro information page (028-klaro-nav-integration, FR-003–FR-009): a
 * static, fully-specified page (not a placeholder) explaining what Klaro is,
 * linking out to the standalone app, and describing the account/data-sync
 * roadmap. No inputs, no backend call — FR-011 forbids exposing any real
 * Klaro account data (contracts/klaro-nav-and-page.md).
 *
 * Inline template/styles, not templateUrl/styleUrl (020, 021): this
 * component is lazy-loaded cross-package by `apps/frontend/src/app.routes.ts`,
 * and `@angular/build:unit-test` externalizes every workspace-linked package
 * during its build step, skipping Angular's own resource-inlining there —
 * see `IconComponent`'s identical note in `@vaultfolio/frontend-shared-ui`.
 */
@Component({
  selector: 'app-klaro-page',
  imports: [CardModule, TranslatePipe],
  template: `
    <div class="klaro-page">
      <p-card>
        <div class="hero">
          <img class="hero__mark" src="klaro-logo.png" alt="" />
          <div>
            <h1>Klaro</h1>
            <p class="hero__subtitle">{{ 'klaroPage.heroSubtitle' | translate }}</p>
          </div>
        </div>
        <p class="description">{{ 'klaroPage.description' | translate }}</p>
        <ul class="features">
          <li>{{ 'klaroPage.feature1' | translate }}</li>
          <li>{{ 'klaroPage.feature2' | translate }}</li>
          <li>{{ 'klaroPage.feature3' | translate }}</li>
          <li>{{ 'klaroPage.feature4' | translate }}</li>
        </ul>
      </p-card>

      <p-card styleClass="standalone-banner">
        <p>{{ 'klaroPage.standaloneBanner' | translate }}</p>
        <a
          class="external-link"
          href="https://klaro.allwang.family/"
          target="_blank"
          rel="noopener"
        >
          {{ 'klaroPage.externalLinkLabel' | translate }}
        </a>
        <p class="external-link__caption">{{ 'klaroPage.externalLinkCaption' | translate }}</p>
      </p-card>

      <p-card header="Where this is headed">
        <dl class="roadmap">
          <dt>Today</dt>
          <dd>{{ 'klaroPage.roadmapToday' | translate }}</dd>
          <dt>Sync</dt>
          <dd>{{ 'klaroPage.roadmapSync' | translate }}</dd>
          <dt>Future</dt>
          <dd>{{ 'klaroPage.roadmapFuture' | translate }}</dd>
        </dl>
      </p-card>
    </div>
  `,
  styles: `
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
    }

    .klaro-page {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .hero {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .hero__mark {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      flex: 0 0 auto;
    }

    .hero h1 {
      margin: 0;
      font-size: 1.15rem;
    }

    .hero__subtitle {
      margin: 0.15rem 0 0;
      color: var(--p-text-muted-color);
      font-size: 0.86rem;
    }

    .description {
      margin: 1.1rem 0 0;
      font-size: 0.88rem;
      color: var(--p-text-color);
    }

    .features {
      margin: 0.85rem 0 0;
      padding-left: 1.15rem;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.35rem 1rem;
      font-size: 0.84rem;
      color: var(--p-text-muted-color);
    }

    @media (max-width: 640px) {
      .features {
        grid-template-columns: 1fr;
      }
    }

    .external-link {
      display: inline-block;
      margin-top: 0.6rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
      font-weight: 600;
      font-size: 0.85rem;
      text-decoration: none;
    }

    .external-link__caption {
      margin: 0.5rem 0 0;
      font-size: 0.78rem;
      color: var(--p-text-muted-color);
    }

    .roadmap {
      margin: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.4rem 0.85rem;
      font-size: 0.84rem;
    }

    .roadmap dt {
      font-weight: 600;
      color: var(--p-text-color);
    }

    .roadmap dd {
      margin: 0;
      color: var(--p-text-muted-color);
    }
  `,
})
export class KlaroPageComponent {}
