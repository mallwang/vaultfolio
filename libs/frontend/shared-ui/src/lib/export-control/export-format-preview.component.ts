import { Component, Input, signal } from '@angular/core';
import type { ExportFormat } from '@vaultfolio/export';

/**
 * Static, dimmed mock-up of what a format looks like (page with charts, spreadsheet grid, CSV
 * text, JSON code). Identical for every feature and shows invented values only — it never reads
 * the user's data, so opening the export dialog costs nothing and exposes nothing.
 *
 * Inline template/styles, like `ExportControlComponent` (see there for why).
 */
@Component({
  selector: 'app-export-format-preview',
  host: { 'aria-hidden': 'true', class: 'preview' },
  template: `
    @switch (formatSignal()) {
      @case ('pdf') {
        <div class="page">
          <div class="page__title"></div>
          <div class="page__bars">
            <span style="height: 40%"></span><span style="height: 70%"></span>
            <span style="height: 55%"></span><span style="height: 90%"></span>
          </div>
          <div class="page__line"></div>
          <div class="page__line page__line--short"></div>
        </div>
      }
      @case ('xlsx') {
        <div class="grid">
          @for (cell of gridCells; track $index) {
            <span [class.grid__head]="$index < 3"></span>
          }
        </div>
      }
      @case ('csv') {
        <pre class="code">
Jahr;Brutto;Netto
2023;48000;31000
2024;51000;33000</pre>
      }
      @case ('json') {
        <pre class="code">{{ jsonSample }}</pre>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      width: 5.5rem;
      height: 6.5rem;
      flex: none;
      overflow: hidden;
      opacity: 0.55;
      border: 1px solid var(--p-content-border-color);
      border-radius: 0.375rem;
      background: var(--p-content-background);
      pointer-events: none;
    }
    .page {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      padding: 0.5rem;
      height: 100%;
    }
    .page__title {
      height: 0.4rem;
      width: 60%;
      background: var(--p-text-color);
      border-radius: 2px;
    }
    .page__bars {
      display: flex;
      align-items: flex-end;
      gap: 0.25rem;
      height: 2.4rem;
    }
    .page__bars span {
      flex: 1;
      background: var(--p-primary-color);
      border-radius: 2px 2px 0 0;
    }
    .page__line {
      height: 0.25rem;
      background: var(--p-content-border-color);
      border-radius: 2px;
    }
    .page__line--short {
      width: 60%;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      height: 100%;
    }
    .grid span {
      border: 1px solid var(--p-content-border-color);
    }
    .grid__head {
      background: var(--p-primary-color);
      opacity: 0.4;
    }
    .code {
      margin: 0;
      padding: 0.4rem;
      font-family: monospace;
      font-size: 0.5rem;
      line-height: 1.3;
      color: var(--p-text-color);
      white-space: pre;
    }
  `,
})
export class ExportFormatPreviewComponent {
  @Input({ required: true }) set format(value: ExportFormat) {
    this.formatSignal.set(value);
  }

  protected readonly formatSignal = signal<ExportFormat>('pdf');

  protected readonly gridCells = Array.from({ length: 18 });
  protected readonly jsonSample = '{\n  "year": 2024,\n  "gross": 51000,\n  "net": 33000\n}';
}
