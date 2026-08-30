import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CurrentUserStore } from '../../../auth/current-user.store';
import { APPLICATION_AREAS } from '../application-areas';
import { TranslatePipe } from '../../i18n/translate.pipe';

/**
 * Persistent nav shell (FR-003, FR-009): a desktop sidebar nav list, and a
 * mobile horizontally-scrollable top-bar variant of the same items — toggled
 * via CSS media query rather than two separate components (research.md §4).
 * Areas are filtered by the current user's role (research.md "Decision:
 * Role-based nav visibility via a filtered list") so role-gated areas like
 * Admin are never rendered for a user who shouldn't see them (FR-005, FR-006).
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app-sidebar.component.html',
  styleUrl: './app-sidebar.component.css',
})
export class AppSidebarComponent {
  private readonly currentUserStore = inject(CurrentUserStore);

  protected readonly areas = computed(() => {
    const role = this.currentUserStore.current()?.role;
    return APPLICATION_AREAS.filter((area) => !area.roles || (role && area.roles.includes(role)));
  });
}
