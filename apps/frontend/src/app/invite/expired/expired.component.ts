import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { IconComponent } from '@vaultfolio/frontend-shared-ui';

/**
 * Neutral "no longer valid" page (design.md "Invite-expired page", FR-012):
 * shown for used/cancelled/expired/unknown tokens alike — no distinguishing
 * detail, same shell-less layout as the accept page.
 */
@Component({
  selector: 'app-invite-expired',
  imports: [ButtonModule, CardModule, RouterLink, IconComponent],
  templateUrl: './expired.component.html',
  styleUrl: './expired.component.css',
})
export class ExpiredComponent {}
