import { Component } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { ProfileComponent } from './profile/profile.component';
import { PreferencesComponent } from './preferences/preferences.component';

/**
 * Settings area (012-restructure-admin-nav): a "Profile" sub-tab (008 —
 * every signed-in user, listed first per design.md) plus a "Preferences"
 * sub-tab, both visible to every signed-in user regardless of role. The
 * admin-only sections previously hosted here (Accounts, Sign-ups,
 * Invitations, General) have moved to the dedicated `/app/admin` area.
 */
@Component({
  selector: 'app-settings',
  imports: [TabsModule, ProfileComponent, PreferencesComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {}
