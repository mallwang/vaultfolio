import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

/**
 * Dashboard placeholder area (FR-005): three stat-card shells plus an
 * empty-state panel establishing the layout future portfolio data will fill
 * (design.md "Dashboard").
 */
@Component({
  selector: 'app-dashboard',
  imports: [CardModule, TagModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {}
