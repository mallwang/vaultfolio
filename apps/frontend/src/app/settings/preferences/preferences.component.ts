import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

/**
 * Settings > Preferences (012-restructure-admin-nav): extracted, unchanged
 * "coming soon" placeholder previously inline in Settings' old General tab
 * (research.md "Decision: Preferences promoted to a small standalone
 * component"). Visible to every signed-in user, alongside Profile.
 */
@Component({
  selector: 'app-preferences',
  imports: [CardModule, TagModule],
  templateUrl: './preferences.component.html',
  styleUrl: './preferences.component.css',
})
export class PreferencesComponent {}
