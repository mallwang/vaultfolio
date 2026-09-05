import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { CurrentUserStore } from '../../../auth/current-user.store';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { isDomainEntitled } from '@vaultfolio/frontend-domain-access';
import { APPLICATION_AREAS } from '../application-areas';

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
  imports: [RouterLink, RouterLinkActive, TranslatePipe, IconComponent, TooltipModule],
  templateUrl: './app-sidebar.component.html',
  styleUrl: './app-sidebar.component.css',
  host: { '[class.collapsed]': 'collapsed()' },
})
export class AppSidebarComponent {
  private readonly currentUserStore = inject(CurrentUserStore);

  protected readonly areas = computed(() => {
    const user = this.currentUserStore.current();
    const role = user?.role;
    return APPLICATION_AREAS.filter((area) => {
      const roleAllowed = !area.roles || (role && area.roles.includes(role));
      // FR-006 (020): a domain-gated area is hidden the same way a
      // role-gated one already is — both filters compose, so an area with
      // both `roles` and `domainId` needs to pass each check.
      const domainAllowed = !area.domainId || isDomainEntitled(user, area.domainId);
      return roleAllowed && domainAllowed;
    });
  });

  protected readonly collapsed = signal(
    localStorage.getItem('vaultfolio-sidebar-collapsed') === 'true',
  );

  protected toggleCollapsed(): void {
    this.collapsed.update((v) => {
      const next = !v;
      localStorage.setItem('vaultfolio-sidebar-collapsed', String(next));
      return next;
    });
  }
}
