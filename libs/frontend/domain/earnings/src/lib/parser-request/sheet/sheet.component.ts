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
          @for (word of line.words; track $index; let i = $index) {
            <button
              type="button"
              class="word"
              [class]="'word word--' + word.mark.toLowerCase()"
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
    .word {
      position: absolute;
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
  readonly wordClick = output<WordClick>();
}
