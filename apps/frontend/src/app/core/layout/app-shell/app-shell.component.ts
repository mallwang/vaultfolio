import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FeedbackDialogComponent } from '../../feedback/feedback-dialog/feedback-dialog.component';
import { FeedbackStore } from '../../feedback/feedback.store';
import { DomainMaintenanceGateComponent } from '../../maintenance/domain-maintenance-gate.component';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';

/**
 * Authenticated layout: sidebar + routed content, per the two-region layout
 * in design.md's ASCII diagram (FR-004). Used only as the `component` of
 * the `app` parent route (app.routes.ts), which already carries `authGuard`
 * — so this only ever renders once the visitor is signed in. The header now
 * lives at the application root (`App`, research.md #1), not here.
 */
@Component({
  selector: 'app-shell',
  imports: [AppSidebarComponent, DomainMaintenanceGateComponent, FeedbackDialogComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
})
export class AppShellComponent {
  private readonly feedback = inject(FeedbackStore);
  private readonly router = inject(Router);

  constructor() {
    // The draft hint links to `?feedback=draft`: open the dialog and strip the param.
    inject(ActivatedRoute).queryParamMap.subscribe((params) => {
      if (params.get('feedback') !== 'draft') return;
      this.feedback.openDialog();
      void this.router.navigate([], {
        queryParams: { feedback: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }
}
