import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import type { AnonPage } from '@vaultfolio/earnings';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';

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
  imports: [ButtonModule, TranslatePipe],
  template: `
    <div class="toolbar" role="group" [attr.aria-label]="'requests.wizard.sheet.zoom' | translate">
      <button
        pButton
        type="button"
        size="small"
        severity="secondary"
        outlined
        [disabled]="zoom() <= MIN_ZOOM"
        [attr.aria-label]="'requests.wizard.sheet.zoomOut' | translate"
        data-testid="request-zoom-out"
        (click)="zoomBy(-ZOOM_STEP)"
      >
        −
      </button>
      <span class="zoom-value" data-testid="request-zoom-value">{{ percent() }}%</span>
      <button
        pButton
        type="button"
        size="small"
        severity="secondary"
        outlined
        [disabled]="zoom() >= MAX_ZOOM"
        [attr.aria-label]="'requests.wizard.sheet.zoomIn' | translate"
        data-testid="request-zoom-in"
        (click)="zoomBy(ZOOM_STEP)"
      >
        +
      </button>
      <button
        pButton
        type="button"
        size="small"
        severity="secondary"
        outlined
        [disabled]="zoom() === 1"
        data-testid="request-zoom-fit"
        (click)="zoom.set(1)"
      >
        {{ 'requests.wizard.sheet.fit' | translate }}
      </button>
    </div>
    <div class="viewport">
      @for (page of pages(); track $index; let p = $index) {
        <div
          class="page"
          [style.--aspect]="page.width / page.height"
          [style.--zoom]="zoom()"
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
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .zoom-value {
      min-width: 3.5rem;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .viewport {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
      /* the page fits the viewport height at 100% and scrolls inside this box when zoomed in */
      max-height: calc(100dvh - 6rem);
      overflow: auto;
    }
    .page {
      position: relative;
      container-type: inline-size;
      flex-shrink: 0;
      width: calc(min(100%, (100dvh - 7rem) * var(--aspect)) * var(--zoom));
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
    .word--masked {
      background: var(--p-surface-200);
      color: var(--p-text-muted-color);
      border-radius: 2px;
    }
    .word--kept {
      border: 1px solid var(--p-green-500);
    }
  `,
})
export class SheetComponent {
  protected readonly MIN_ZOOM = 0.5;
  protected readonly MAX_ZOOM = 3;
  protected readonly ZOOM_STEP = 0.25;
  /** 1 = the whole page fits the screen height (and never exceeds the column width). */
  protected readonly zoom = signal(1);
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

  protected percent(): number {
    return Math.round(this.zoom() * 100);
  }

  protected zoomBy(delta: number): void {
    this.zoom.update((z) => Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, z + delta)));
  }

  protected isSelected(page: number, line: number): boolean {
    const selected = this.selected();
    return selected?.page === page && selected.line === line;
  }

  protected rowLabel(page: number, line: number): string {
    const words = this.pages()[page].lines[line].words.map((w) => w.text);
    return `${this.rowName()} ${line + 1}: ${words.join(' ')}`;
  }
}
