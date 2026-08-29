import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { HealthStatusComponent } from './health-status/health-status.component';
import { ProfileComponent } from './profile/profile.component';
import { AccountsComponent } from './accounts/accounts.component';
import { InvitationsComponent } from './invitations/invitations.component';
import { SignupsComponent } from './signups/signups.component';

/**
 * Settings area: a "Profile" sub-tab (008 — every signed-in user, non-admin-
 * gated, listed first per design.md), then the admin-only "Accounts",
 * "Invitations", and "Sign-ups" sub-tabs, plus a "General" tab hosting the
 * pre-existing health-status screen and preferences placeholder.
 */
@Component({
  selector: 'app-settings',
  imports: [
    CardModule,
    TagModule,
    TabsModule,
    HealthStatusComponent,
    ProfileComponent,
    AccountsComponent,
    InvitationsComponent,
    SignupsComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {}
