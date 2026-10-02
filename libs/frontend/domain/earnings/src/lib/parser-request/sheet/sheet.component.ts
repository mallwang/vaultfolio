import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AnonPage } from '@vaultfolio/earnings';

export interface WordClick {
  page: number;
  line: number;
  index: number;
}

/**
 * The rebuilt page as the administrators will see it (R7): monospace words absolutely placed with
 * the sample's coordinates. Every word is a keyboard-operable button; locked (removed) words are
 * disabled. Colour and a dotted/dashed/solid border distinguish the marks, never colour alone.
 */
@Component({
  selector: 'app-request-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (page of pages(); track $index; let p = $index) {
      <div
        class="page"
        [style.aspect-ratio]="page.width + ' / ' + page.height"
        [attr.data-testid]="'request-sheet-page-' + p"
      >
        @for (line of page.lines; track $index; let l = $index) {
          @if (mode() === 'rules') {
            <button
              type="button"
              class="row"
              [class.row--selected]="isSelected(p, l)"
              [style.top]="((line.y - line.size) / page.height) * 100 + '%'"
              [style.height]="(line.size / page.height) * 110 + '%'"
              [attr.aria-label]="rowLabel(p, l)"
              [attr.aria-pressed]="isSelected(p, l)"
              [attr.data-testid]="'request-rule-row-' + p + '-' + l"
              (click)="rowClick.emit({ page: p, line: l })"
            >
              @if (chips().get(p + '-' + l); as chip) {
                <span class="chip" [attr.data-testid]="'request-rule-chip-' + p + '-' + l">{{
                  chip
                }}</span>
              }
            </button>
          }
          @for (word of line.words; track $index; let i = $index) {
            <button
              type="button"
              class="word"
              [class]="'word word--' + word.mark.toLowerCase()"
              [class.word--picked]="picked().has(p + '-' + l + '-' + i)"
              [class.word--lowconf]="word.lowConfidence === true"
              [disabled]="word.locked"
              [style.left]="(word.x / page.width) * 100 + '%'"
              [style.top]="((line.y - line.size) / page.height) * 100 + '%'"
              [style.font-size]="(line.size / page.width) * 100 + 'cqw'"
              [attr.aria-label]="word.text + ' (' + word.mark.toLowerCase() + ')'"
              [attr.data-testid]="'request-word-' + p + '-' + l + '-' + i"
              (click)="wordClick.emit({ page: p, line: l, index: i })"
            >
              {{ word.text }}
            </button>
          }
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .page {
      position: relative;
      container-type: inline-size;
      width: 100%;
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      overflow: hidden;
    }
    .row {
      position: absolute;
      left: 0;
      right: 0;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      text-align: right;
    }
    .row:hover {
      background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
    }
    .row--selected {
      background: color-mix(in srgb, var(--p-primary-color) 14%, transparent);
      outline: 1px solid var(--p-primary-color);
    }
    .chip {
      position: relative;
      margin-right: 4px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
      font-size: 0.7rem;
    }
    .word--picked {
      outline: 2px solid var(--p-primary-color);
      outline-offset: 1px;
    }
    .word {
      position: absolute;
      z-index: 1;
      margin: 0;
      padding: 0 1px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--p-text-color);
      font-family: ui-monospace, 'Courier New', monospace;
      line-height: 1.1;
      white-space: pre;
      cursor: pointer;
    }
    .word:disabled {
      cursor: not-allowed;
    }
    .word:focus-visible {
      outline: 2px solid var(--p-primary-color);
    }
    .word--value {
      border-bottom: 1px dotted var(--p-text-muted-color);
    }
    .word--lowconf {
      text-decoration: underline wavy var(--p-orange-500);
      text-underline-offset: 2px;
    }
    .word--removed {
      background: var(--p-surface-300);
      color: transparent;
      border-radius: 2px;
    }
    .word--needs_decision {
      background: color-mix(in srgb, var(--p-orange-500) 25%, transparent);
      border: 1px dashed var(--p-orange-500);
    }
    .word--masked {
      background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
      border: 1px solid var(--p-primary-color);
    }
    .word--kept {
      border: 1px solid var(--p-green-500);
    }
  `,
})
export class SheetComponent {
  readonly pages = input.required<AnonPage[]>();
  /** `rules` (step 3) adds a clickable row per line; `words` (step 2/4) is the plain sheet. */
  readonly mode = input<'words' | 'rules'>('words');
  /** Rules mode: chip text per `<page>-<line>`, the selected line and the picked number words. */
  readonly chips = input<ReadonlyMap<string, string>>(new Map());
  readonly selected = input<{ page: number; line: number } | null>(null);
  readonly picked = input<ReadonlySet<string>>(new Set());
  /** Rules mode: accessible name prefix of a row. */
  readonly rowName = input('Line');
  readonly wordClick = output<WordClick>();
  readonly rowClick = output<{ page: number; line: number }>();

  protected isSelected(page: number, line: number): boolean {
    const selected = this.selected();
    return selected?.page === page && selected.line === line;
  }

  protected rowLabel(page: number, line: number): string {
    const words = this.pages()[page].lines[line].words.map((w) => w.text);
    return `${this.rowName()} ${line + 1}: ${words.join(' ')}`;
  }
}
