import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { HealthStatusComponent } from './health-status/health-status.component';
import { AccountsComponent } from './accounts/accounts.component';
import { InvitationsComponent } from './invitations/invitations.component';
import { SignupsComponent } from './signups/signups.component';

/**
 * Settings area: "Accounts", "Invitations", and "Sign-ups" sub-tabs
 * (design.md — admin-only account management, nested here rather than a new
 * top-level nav item) plus a "General" tab hosting the pre-existing
 * health-status screen and preferences placeholder.
 */
@Component({
  selector: 'app-settings',
  imports: [
    CardModule,
    TagModule,
    TabsModule,
    HealthStatusComponent,
    AccountsComponent,
    InvitationsComponent,
    SignupsComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {}
