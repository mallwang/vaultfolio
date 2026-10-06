import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

/** Header row of a filled dashboard tile: title on the left, link to the feature page on the right. */
@Component({
  selector: 'app-widget-header',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="head">
      <strong>{{ title }}</strong>
      <a [routerLink]="link" [attr.data-testid]="linkTestId">
        <span class="label">{{ linkLabel }}</span> <app-icon name="chevron-right" />
      </a>
    </div>
  `,
  styles: `
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }
    a {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-primary-color);
      font-size: 0.875rem;
      text-decoration: none;
    }
    a:hover .label {
      text-decoration: underline;
    }
  `,
})
export class WidgetHeaderComponent {
  // Decorator inputs: workspace-linked libs are externalized in unit tests and not signal-input-compiled.
  @Input({ required: true }) title = '';
  @Input({ required: true }) link = '';
  @Input({ required: true }) linkLabel = '';
  @Input() linkTestId?: string;
}
