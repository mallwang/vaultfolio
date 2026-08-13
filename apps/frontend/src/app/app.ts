import { Component } from '@angular/core';
import { HealthStatusComponent } from './health-status/health-status.component';

@Component({
  imports: [HealthStatusComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'frontend';
}
