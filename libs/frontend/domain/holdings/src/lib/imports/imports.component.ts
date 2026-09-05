import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/**
 * Imports placeholder area (FR-005): a dropzone-style empty state signaling
 * the eventual file-import interaction without implementing it (design.md
 * "Imports").
 *
 * Inline template/styles, not templateUrl/styleUrl (020, 021): this
 * component is now consumed cross-package (`apps/frontend/src/app.routes.ts`
 * lazy-loads it as the Holdings area's "Imports" tab), and
 * `@angular/build:unit-test` externalizes every workspace-linked package
 * during its build step, skipping Angular's own resource-inlining
 * there — see `IconComponent`'s identical note in
 * `@vaultfolio/frontend-shared-ui`.
 */
@Component({
  selector: 'app-imports',
  imports: [CardModule, IconComponent, TranslatePipe],
  template: `
    <p-card>
      <div class="dropzone">
        <app-icon name="upload" />
        <strong>{{ 'imports.dropzoneTitle' | translate }}</strong>
        <p>{{ 'imports.dropzoneBody' | translate }}</p>
      </div>
    </p-card>
  `,
  styles: `
    :host {
      display: block;
      max-width: 640px;
      margin: 0 auto;
    }

    .dropzone {
      border: 1.5px dashed var(--p-content-border-color);
      border-radius: 12px;
      padding: 2.25rem 1.5rem;
      text-align: center;
      background: var(--p-content-background);
      color: var(--p-text-muted-color);
    }

    .dropzone app-icon {
      font-size: 1.9rem;
      margin: 0 auto 0.75rem;
      color: var(--p-primary-color);
      display: block;
    }

    .dropzone strong {
      color: var(--p-text-color);
      display: block;
      margin-bottom: 0.25rem;
      font-size: 0.92rem;
    }

    .dropzone p {
      margin: 0;
      font-size: 0.82rem;
    }
  `,
})
export class ImportsComponent {}
