import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { IconComponent } from '../../shared/icon/icon.component';

/**
 * Shared "no longer valid" page (design.md "Link-invalid page", Edge Cases/
 * SC-002): one page for both an expired/used/superseded password-reset link
 * and an expired/used/superseded email-change-verification link — mirrors
 * `invite/expired`'s no-distinguishing-detail approach.
 */
@Component({
  selector: 'app-link-invalid',
  imports: [ButtonModule, CardModule, RouterLink, IconComponent],
  templateUrl: './link-invalid.component.html',
  styleUrl: './link-invalid.component.css',
})
export class LinkInvalidComponent {}
