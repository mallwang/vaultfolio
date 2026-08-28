import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { APPLICATION_AREAS } from '../application-areas';

/**
 * Persistent nav shell (FR-003, FR-009): a desktop sidebar nav list, and a
 * mobile horizontally-scrollable top-bar variant of the same items — toggled
 * via CSS media query rather than two separate components (research.md §4).
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './app-sidebar.component.html',
  styleUrl: './app-sidebar.component.css',
})
export class AppSidebarComponent {
  protected readonly areas = APPLICATION_AREAS;
}
