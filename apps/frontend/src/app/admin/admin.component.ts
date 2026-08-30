import { Component } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { AccountsComponent } from './accounts/accounts.component';
import { InvitationsComponent } from './invitations/invitations.component';
import { SignupsComponent } from './signups/signups.component';
import { HealthStatusComponent } from './health-status/health-status.component';

/**
 * Admin area (012-restructure-admin-nav): the admin-only "Accounts",
 * "Sign-ups", and "Invitations" sub-tabs, plus a "General" tab hosting the
 * pre-existing health-status screen — relocated out of Settings and gated by
 * `adminGuard` at the route level (plan.md, research.md "Decision: Admin tab
 * container mirrors Settings' existing PrimeNG tabs pattern").
 */
@Component({
  selector: 'app-admin',
  imports: [
    TabsModule,
    AccountsComponent,
    InvitationsComponent,
    SignupsComponent,
    HealthStatusComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent {}
