import { Component, HostBinding, Input } from '@angular/core';
import { ICON_NAME_MAP } from './icon-name.map';

const FALLBACK_GLYPH = 'error';

/**
 * Renders a single Material Symbols Outlined glyph resolved from a stable
 * semantic name (research.md §2, data-model.md "Icon Name Map").
 *
 * Decorative by default (`aria-hidden="true"` on the host) — call sites
 * where the icon is an interactive element's only content must keep/add an
 * `aria-label` on that parent control themselves (research.md §4).
 */
@Component({
  selector: 'app-icon',
  imports: [],
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.css',
})
export class IconComponent {
  /** Semantic icon name, e.g. 'trash'. Looked up in `ICON_NAME_MAP`. */
  @Input({ required: true }) name!: string;

  /** When true, applies the `vf-icon--spin` rotation animation. */
  @Input() spin = false;

  @HostBinding('attr.aria-hidden') readonly ariaHidden = 'true';

  get glyph(): string {
    const mapped = ICON_NAME_MAP[this.name];
    if (mapped === undefined) {
      // FR-007: unmapped icon names must fail visibly, not silently.
      console.warn(
        `[app-icon] Unknown icon name "${this.name}" — no entry in ICON_NAME_MAP. ` +
          `Falling back to the "${FALLBACK_GLYPH}" glyph.`,
      );
      return FALLBACK_GLYPH;
    }
    return mapped;
  }

  get isUnknown(): boolean {
    return ICON_NAME_MAP[this.name] === undefined;
  }
}
