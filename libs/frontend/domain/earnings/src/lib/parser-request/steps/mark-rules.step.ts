import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FIGURE_TYPES,
  type FigureType,
  RULE_FORMATS,
  type RuleFormat,
  wordKey,
} from '@vaultfolio/earnings';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from '../parser-request.store';
import { SheetComponent, type WordClick } from '../sheet/sheet.component';
import { wizardText } from './wizard-text';

/**
 * Step 3 (optional, FR-010–FR-014): the user marks which lines are which figure and where the
 * number column is. The markings are a hint for the developer and are never executed. The live
 * check reads the ORIGINAL amounts on this device; its result is shown here and never sent.
 */
@Component({
  selector: 'app-request-mark-rules-step',
  imports: [
    FormsModule,
    ButtonModule,
    MessageModule,
    SelectModule,
    TranslatePipe,
    IconComponent,
    SheetComponent,
  ],
  template: `
    <p-message severity="info">{{ 'requests.wizard.rules.optional' | translate }}</p-message>

    <div class="split">
      <app-request-sheet
        mode="rules"
        [pages]="store.anon()?.pages ?? []"
        [chips]="chips()"
        [selected]="store.selectedLine()"
        [picked]="picked()"
        [rowName]="t('requests.wizard.rules.rowName')"
        (rowClick)="store.selectLine($event.page, $event.line)"
        (wordClick)="onWord($event)"
      />

      <div class="side">
        <section class="card" data-testid="request-rule-selected">
          <h3>{{ 'requests.wizard.rules.selectedTitle' | translate }}</h3>
          @if (store.selectedLine(); as line) {
            <label for="request-rule-figure">{{
              'requests.wizard.rules.figureLabel' | translate
            }}</label>
            <p-select
              inputId="request-rule-figure"
              data-testid="request-rule-figure"
              [options]="figureOptions()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="store.selectedRule()?.figure ?? null"
              (ngModelChange)="store.setFigure($event)"
            />
            @if (store.selectedRule(); as rule) {
              <label for="request-rule-sign">{{
                'requests.wizard.rules.signLabel' | translate
              }}</label>
              <p-select
                inputId="request-rule-sign"
                data-testid="request-rule-sign"
                [options]="signOptions()"
                optionLabel="label"
                optionValue="value"
                [ngModel]="rule.deduction"
                (ngModelChange)="store.patchSelectedRule({ deduction: $event })"
              />
              <p class="hint" data-testid="request-rule-column">
                {{
                  rule.column
                    ? t('requests.wizard.rules.columnSet')
                    : t('requests.wizard.rules.columnHint')
                }}
              </p>
              <label for="request-rule-format">{{
                'requests.wizard.rules.formatLabel' | translate
              }}</label>
              <p-select
                inputId="request-rule-format"
                data-testid="request-rule-format"
                [options]="formatOptions()"
                optionLabel="label"
                optionValue="value"
                [ngModel]="rule.format ?? null"
                [placeholder]="t('requests.wizard.rules.formatNone')"
                (ngModelChange)="store.patchSelectedRule({ format: $event })"
              />
            }
          } @else {
            <p class="hint">{{ 'requests.wizard.rules.noLine' | translate }}</p>
          }
          <div class="period">
            <button
              pButton
              type="button"
              severity="secondary"
              outlined
              size="small"
              data-testid="request-rule-period"
              [disabled]="store.pickingPeriod()"
              (click)="store.pickingPeriod.set(true)"
            >
              {{ 'requests.wizard.rules.periodPick' | translate }}
            </button>
            @if (store.pickingPeriod()) {
              <span class="hint" data-testid="request-rule-period-hint">{{
                'requests.wizard.rules.periodPicking' | translate
              }}</span>
            } @else if (store.ruleDraft()?.period) {
              <span class="hint" data-testid="request-rule-period-set">{{
                'requests.wizard.rules.periodSet' | translate
              }}</span>
              <button
                pButton
                type="button"
                severity="secondary"
                text
                size="small"
                data-testid="request-rule-period-clear"
                (click)="store.clearPeriod()"
              >
                {{ 'requests.wizard.rules.periodClear' | translate }}
              </button>
            }
          </div>
        </section>

        <section class="card" data-testid="request-live-check">
          <h3>{{ 'requests.wizard.rules.liveTitle' | translate }}</h3>
          <p class="hint">
            <app-icon name="lock" /> {{ 'requests.wizard.rules.liveLock' | translate }}
          </p>
          @if (store.liveCheck(); as check) {
            @for (item of check.checks; track item.id) {
              <p
                class="check"
                [class.check--ok]="item.passed === true"
                [class.check--fail]="item.passed === false"
                [attr.data-testid]="'request-check-' + item.id.toLowerCase()"
                [attr.data-state]="state(item.passed)"
              >
                <app-icon [name]="icon(item.passed)" />
                <span>
                  <strong>{{ t('requests.wizard.rules.check' + item.id) }}</strong>
                  — {{ t('requests.wizard.rules.state.' + state(item.passed)) }}
                  @if (item.passed === false) {
                    <br />
                    {{ t('requests.wizard.rules.involved', { list: figureList(item.involved) }) }}
                  }
                </span>
              </p>
            }
          } @else {
            <p class="hint">{{ 'requests.wizard.rules.liveNone' | translate }}</p>
          }
        </section>
      </div>
    </div>

    <div class="actions">
      <button
        pButton
        type="button"
        severity="secondary"
        outlined
        data-testid="request-back"
        (click)="store.step.set('review')"
      >
        {{ 'requests.wizard.back' | translate }}
      </button>
      <button
        pButton
        type="button"
        severity="secondary"
        data-testid="request-skip-rules"
        (click)="skip()"
      >
        {{ 'requests.wizard.rules.skip' | translate }}
      </button>
      <button
        pButton
        type="button"
        data-testid="request-continue"
        (click)="store.step.set('preview')"
      >
        {{ 'requests.wizard.continue' | translate }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    :host > * {
      flex-shrink: 0;
    }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: 1rem;
      align-items: start;
    }
    @media (max-width: 900px) {
      .split {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    .hint {
      margin: 0;
      color: var(--p-text-muted-color);
    }
    .period {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .check {
      display: flex;
      gap: 0.5rem;
      margin: 0;
      color: var(--p-text-muted-color);
    }
    .check--ok {
      color: var(--p-green-600);
    }
    .check--fail {
      color: var(--p-red-600);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class MarkRulesStepComponent {
  protected readonly store = inject(ParserRequestStore);
  protected readonly t = wizardText();

  protected readonly chips = computed(
    () =>
      new Map(
        this.store
          .ruleLines()
          .map((rule) => [
            `${rule.page}-${rule.line}`,
            this.t(`requests.wizard.rules.figures.${rule.figure}`),
          ]),
      ),
  );

  /** Words that are the picked number column of a marked line or the period. */
  protected readonly picked = computed(() => {
    const analysis = this.store.analysis();
    const keys = new Set<string>();
    if (!analysis) return keys;
    const draft = this.store.ruleDraft();
    const ranges = [
      ...this.store
        .ruleLines()
        .flatMap((rule) => (rule.column ? [{ ...rule, ...rule.column }] : [])),
      ...(draft?.period ? [draft.period] : []),
    ];
    for (const range of ranges) {
      analysis.pages[range.page]?.lines[range.line]?.words.forEach((word, i) => {
        if (word.x === range.x0 && word.x + word.width === range.x1) {
          keys.add(wordKey(range.page, range.line, i));
        }
      });
    }
    return keys;
  });

  protected readonly figureOptions = computed(() => [
    { label: this.t('requests.wizard.rules.figureNone'), value: null },
    ...FIGURE_TYPES.map((figure) => ({
      label: this.t(`requests.wizard.rules.figures.${figure}`),
      value: figure,
    })),
  ]);

  protected readonly signOptions = computed(() => [
    { label: this.t('requests.wizard.rules.signAdd'), value: false },
    { label: this.t('requests.wizard.rules.signDeduct'), value: true },
  ]);

  protected readonly formatOptions = computed(() =>
    RULE_FORMATS.map((format: RuleFormat) => ({
      label: this.t(`requests.wizard.rules.formats.${format}`),
      value: format,
    })),
  );

  /** Clicking a word selects its line; on the selected line a number sets the column (or the period). */
  protected onWord(click: WordClick): void {
    const original =
      this.store.analysis()?.pages[click.page]?.lines[click.line]?.words[click.index];
    if (!original) return;
    if (this.store.pickingPeriod()) {
      this.store.pickPeriod(click.page, click.line, click.index);
      return;
    }
    const selected = this.store.selectedLine();
    const onSelected = selected?.page === click.page && selected.line === click.line;
    if (onSelected && /\d/.test(original.text)) {
      this.store.pickColumn(click.page, click.line, click.index);
    } else {
      this.store.selectLine(click.page, click.line);
    }
  }

  protected skip(): void {
    this.store.clearRules();
    this.store.step.set('preview');
  }

  protected state(passed: boolean | null): 'ok' | 'fail' | 'unknown' {
    if (passed === null) return 'unknown';
    return passed ? 'ok' : 'fail';
  }

  protected icon(passed: boolean | null): string {
    if (passed === null) return 'info';
    return passed ? 'check-circle' : 'warning';
  }

  protected figureList(figures: FigureType[]): string {
    return figures.map((figure) => this.t(`requests.wizard.rules.figures.${figure}`)).join(', ');
  }
}
