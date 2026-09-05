import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/**
 * Imports placeholder area (FR-005): a dropzone-style empty state signaling
 * the eventual file-import interaction without implementing it (design.md
 * "Imports").
 */
@Component({
  selector: 'app-imports',
  imports: [CardModule, IconComponent, TranslatePipe],
  templateUrl: './imports.component.html',
  styleUrl: './imports.component.css',
})
export class ImportsComponent {}
