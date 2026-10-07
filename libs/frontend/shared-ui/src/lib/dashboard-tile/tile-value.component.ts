import { Component } from '@angular/core';

/** The headline amount of a dashboard tile — one size for every tile. */
@Component({
  selector: 'app-tile-value',
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
      font-size: var(--tile-value-size, 1.5rem);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
  `,
})
export class TileValueComponent {}
