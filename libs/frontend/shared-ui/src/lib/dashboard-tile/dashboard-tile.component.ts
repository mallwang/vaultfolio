import { Component, ContentChild, Directive, Input, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { TranslatePipe } from '../i18n/translate.pipe';
import { DASHBOARD_TILE_EXPANSION } from './dashboard-tile-expansion.token';

/** Marks the collapsible details of an `app-dashboard-tile`; carries the `tileDetails` slot. */
@Directive({ selector: '[tileDetails]' })
export class TileDetailsDirective {}

let nextDetailsId = 0;

/**
 * The shared frame of a filled dashboard tile: header, main content (default slot plus the fixed
 * chart zone) and optional collapsible details. Details are collapsed by default and not rendered
 * while collapsed; the toggle only exists when details are projected.
 */
@Component({
  selector: 'app-dashboard-tile',
  imports: [RouterLink, IconComponent, TranslatePipe],
  template: `
    <header class="head">
      <strong class="head__title" [attr.title]="title">{{ title }}</strong>
      @if (link) {
        <a
          [routerLink]="link"
          [attr.aria-label]="linkLabel"
          [attr.title]="linkLabel"
          [attr.data-testid]="linkTestId"
        >
          <span class="label">{{ linkLabel }}</span> <app-icon name="chevron-right" />
        </a>
      }
    </header>
    <div class="main">
      <ng-content />
      <div class="chart"><ng-content select="[tileChart]" /></div>
    </div>
    @if (hasDetails()) {
      <div class="foot">
        <button
          type="button"
          class="toggle"
          [attr.aria-expanded]="isExpanded()"
          [attr.aria-controls]="detailsId"
          [attr.data-testid]="testIdPrefix + '-toggle'"
          (click)="toggle()"
        >
          <span>{{
            (isExpanded() ? 'dashboard.tile.hideDetails' : 'dashboard.tile.showDetails') | translate
          }}</span>
          <app-icon name="chevron-down" class="chev" [class.chev--open]="isExpanded()" />
        </button>
      </div>
    }
    @if (hasDetails()) {
      <div
        class="details"
        [id]="detailsId"
        [attr.data-testid]="testIdPrefix + '-details'"
        [hidden]="!isExpanded()"
      >
        @if (isExpanded()) {
          <ng-content select="[tileDetails]" />
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      min-height: var(--tile-min-height, 14rem);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.6rem;
      padding-right: 1.75rem; /* room for the drag handle */
    }
    .head__title {
      min-width: 0;
      overflow: hidden;
      font-size: 1rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    a {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-primary-color);
      font-size: 0.875rem;
      text-decoration: none;
      white-space: nowrap;
    }
    a:hover .label {
      text-decoration: underline;
    }
    /* On narrow tiles (small screens, zoom) the title keeps its room and the link shrinks to its chevron. */
    :host {
      container-type: inline-size;
    }
    @container (max-width: 19rem) {
      .label {
        display: none;
      }
    }
    /* Equal main-content height keeps the toggles of a row aligned even when sub lines differ. */
    .main {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-height: var(--tile-main-min-height, 10.5rem);
    }
    /* Takes whatever main-content height the lines above leave, so charts can use the spare room. */
    .chart {
      display: flex;
      flex: 1;
      align-items: flex-end;
      min-height: var(--tile-chart-height, 3.25rem);
      margin-top: 0.55rem;
    }
    .foot {
      display: flex;
      justify-content: center;
      padding-top: 0.5rem;
    }
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.3rem 0.6rem;
      border: 0;
      border-radius: 0.375rem;
      background: none;
      color: var(--p-text-muted-color);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
    }
    .toggle:hover {
      color: var(--p-text-color);
      background: var(--p-content-hover-background);
    }
    .toggle:focus-visible {
      outline: 2px solid var(--p-primary-color);
    }
    .chev {
      transition: transform 0.15s;
    }
    .chev--open {
      transform: rotate(180deg);
    }
    .details {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px dashed var(--p-content-border-color);
      font-size: 0.875rem;
    }
    .details[hidden] {
      display: none;
    }
  `,
})
export class DashboardTileComponent {
  // Decorator inputs: workspace-linked libs are externalized in unit tests and not signal-input-compiled.
  /** Stable tile id (the contribution `id`); keys the persisted expanded state. */
  @Input({ required: true }) tileId = '';
  @Input({ required: true }) title = '';
  /** Base of the `-toggle` / `-details` test ids. */
  @Input({ required: true }) testIdPrefix = '';
  @Input() link?: string;
  @Input() linkLabel = '';
  @Input() linkTestId?: string;

  // Decorator query with a setter: signal queries are not compiled for externalized workspace libs.
  @ContentChild(TileDetailsDirective) set details(value: TileDetailsDirective | undefined) {
    this.hasDetails.set(value !== undefined);
  }

  protected readonly hasDetails = signal(false);

  protected readonly detailsId = `dashboard-tile-details-${nextDetailsId++}`;

  private readonly expansion = inject(DASHBOARD_TILE_EXPANSION, { optional: true });
  private readonly localExpanded = signal(false);

  protected isExpanded(): boolean {
    return this.expansion ? this.expansion.isExpanded(this.tileId) : this.localExpanded();
  }

  protected toggle(): void {
    const next = !this.isExpanded();
    if (this.expansion) this.expansion.setExpanded(this.tileId, next);
    else this.localExpanded.set(next);
  }
}
