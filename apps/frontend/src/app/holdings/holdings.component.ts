import { Component } from '@angular/core';
import { TableModule } from 'primeng/table';

/**
 * Holdings placeholder area (FR-005): a table shell with real column headers
 * and an empty-state row, so the eventual data table has an established
 * frame (design.md "Holdings").
 */
@Component({
  selector: 'app-holdings',
  imports: [TableModule],
  templateUrl: './holdings.component.html',
  styleUrl: './holdings.component.css',
})
export class HoldingsComponent {
  protected readonly holdings: unknown[] = [];
}
