import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { IconComponent } from '../shared/icon/icon.component';

/**
 * Imports placeholder area (FR-005): a dropzone-style empty state signaling
 * the eventual file-import interaction without implementing it (design.md
 * "Imports").
 */
@Component({
  selector: 'app-imports',
  imports: [CardModule, IconComponent],
  templateUrl: './imports.component.html',
  styleUrl: './imports.component.css',
})
export class ImportsComponent {}
