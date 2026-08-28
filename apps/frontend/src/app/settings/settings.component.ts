import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { HealthStatusComponent } from './health-status/health-status.component';

/**
 * Settings area: hosts the relocated health-status screen ("System health")
 * and a "Preferences" placeholder (design.md "Settings", FR-005, FR-007).
 */
@Component({
  selector: 'app-settings',
  imports: [CardModule, TagModule, HealthStatusComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {}
