import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';

/**
 * Top-level shell composing the sidebar + header + routed content in the
 * two-region layout from design.md's ASCII diagram (FR-003, FR-004).
 */
@Component({
  selector: 'app-shell',
  imports: [AppSidebarComponent, AppHeaderComponent, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
})
export class AppShellComponent {}
