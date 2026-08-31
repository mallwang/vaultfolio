import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { IconComponent } from '../shared/icon/icon.component';
import { TranslatePipe } from '../core/i18n/translate.pipe';

/**
 * Dashboard placeholder area (FR-005): three stat-card shells plus an
 * empty-state panel establishing the layout future portfolio data will fill
 * (design.md "Dashboard").
 */
@Component({
  selector: 'app-dashboard',
  imports: [CardModule, TagModule, TranslatePipe, IconComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {}
