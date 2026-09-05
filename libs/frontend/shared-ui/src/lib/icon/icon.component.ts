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
  // Inline template/styles, not templateUrl/styleUrl (020): `@angular/build:
  // unit-test` externalizes every workspace-linked package during its build
  // step, skipping Angular's own resource-inlining for such packages —
  // `templateUrl`/`styleUrl` would then be left unresolved at test runtime
  // ("Did you run and wait for resolveComponentResources()?"). A self-
  // contained component has no external resource to resolve.
  template: `<span
    class="material-symbols-outlined"
    [class.vf-icon--spin]="spin"
    [class.vf-icon--unknown]="isUnknown"
    >{{ glyph }}</span
  >`,
  styles: `
    /* Material Symbols glyphs sit much higher above the baseline than regular
       text (they're drawn ascent-heavy for standalone use), so the default
       \`vertical-align: baseline\` on an inline element leaves them looking
       shifted up whenever an icon sits next to a text label. Centering the
       glyph's own box against the surrounding line box fixes that regardless
       of the call site's layout. */
    :host {
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
    }

    /* Same visual effect as PrimeIcons' pi-spin: a steady, linear 360deg spin. */
    @keyframes vf-icon-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .vf-icon--spin {
      animation: vf-icon-spin 1s linear infinite;
      display: inline-block;
    }

    /* FR-007: an unmapped icon name must fail visibly, not silently. */
    .vf-icon--unknown {
      color: var(--p-danger-color);
    }
  `,
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
