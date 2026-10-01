import { Component, computed, input } from '@angular/core';
import type { StoredRuleDraft } from '@vaultfolio/earnings';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { requestText } from '../request-text';

/**
 * Rule hints of an `earnings/new-parser` request (033, US4): what the requester marked in the
 * preview. Labels come from the sample, figure types and formats from the user; there are no
 * figure values. Purely informational — nothing here is executed (FR-014).
 */
@Component({
  selector: 'app-earnings-new-parser-view',
  imports: [TranslatePipe],
  template: `
    <h3>{{ 'requests.admin.hints.title' | translate }}</h3>
    <p class="muted" data-testid="request-hints-note">
      {{ 'requests.admin.hints.notExecuted' | translate }}
    </p>
    @if (draft(); as d) {
      @if (d.lines.length > 0) {
        <div class="scroll">
          <table data-testid="request-hints-table">
            <thead>
              <tr>
                <th scope="col">{{ 'requests.admin.hints.line' | translate }}</th>
                <th scope="col">{{ 'requests.admin.hints.label' | translate }}</th>
                <th scope="col">{{ 'requests.admin.hints.figure' | translate }}</th>
                <th scope="col">{{ 'requests.admin.hints.sign' | translate }}</th>
                <th scope="col">{{ 'requests.admin.hints.column' | translate }}</th>
                <th scope="col">{{ 'requests.admin.hints.format' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (line of d.lines; track $index) {
                <tr>
                  <td>{{ line.page + 1 }}/{{ line.line + 1 }}</td>
                  <td>{{ line.label }}</td>
                  <td>{{ t('requests.wizard.rules.figures.' + line.figure) }}</td>
                  <td>
                    {{
                      t(
                        line.deduction
                          ? 'requests.wizard.rules.signDeduct'
                          : 'requests.wizard.rules.signAdd'
                      )
                    }}
                  </td>
                  <td>
                    @if (line.column) {
                      {{ round(line.column.x0) }}–{{ round(line.column.x1) }}
                    } @else {
                      –
                    }
                  </td>
                  <td>
                    @if (line.format) {
                      {{ t('requests.wizard.rules.formats.' + line.format) }}
                    } @else {
                      –
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="muted" data-testid="request-hints-empty">
          {{ 'requests.admin.hints.empty' | translate }}
        </p>
      }
      @if (d.period; as period) {
        <p data-testid="request-hints-period">
          {{
            t('requests.admin.hints.period', {
              line: period.line + 1,
              page: period.page + 1,
              from: round(period.x0),
              to: round(period.x1),
            })
          }}
        </p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 0.25rem 0.5rem;
      text-align: left;
      border-bottom: 1px solid var(--p-content-border-color);
      white-space: nowrap;
    }
    .muted {
      color: var(--p-text-muted-color);
    }
  `,
})
export class EarningsNewParserViewComponent {
  readonly payload = input<unknown>(null);

  protected readonly t = requestText().t;
  protected readonly draft = computed(() => {
    const payload = this.payload() as StoredRuleDraft | null;
    return payload && Array.isArray(payload.lines) ? payload : null;
  });

  protected round(value: number): string {
    return String(Math.round(value));
  }
}
