import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

/**
 * In-shell "not found" state (FR-006) — rendered by the wildcard route so a
 * bad path still shows the persistent nav shell instead of a bare/blank page.
 */
@Component({
  selector: 'app-not-found',
  imports: [ButtonModule, RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
})
export class NotFoundComponent {}
