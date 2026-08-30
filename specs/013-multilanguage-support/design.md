# Design: Multilanguage Support

**Mockup**: [mockup.html](./mockup.html) (local, durable copy) — originally reviewed at https://claude.ai/code/artifact/7ca71f60-c5b6-4d4e-9311-6949f9f58435 (Artifact link may go stale).

## Approved layout

### Header language switcher (US1)

The existing `app-header` right-hand cluster (`app-header__meta`) gains one more item, inserted immediately before the theme toggle (which itself sits immediately before sign-out):

```
[ display name ]  [ role badge ]  [ 🇬🇧 English ▾ ]  [ ☀/🌙 toggle ]  [ Sign out ]
```

- The control is a **labeled pill**, not an icon-only button like the theme toggle: a flag emoji plus the full language name (e.g. "🇬🇧 English"), with a small chevron. Clicking it opens a small dropdown menu listing every `SUPPORTED_LANGUAGES` entry (flag + name), with a checkmark on the currently active one (FR-002).
- Unlike light/dark, there's no single icon that reads as "currently active language," and a flag alone isn't reliably legible as a language name — flag + name together is the smallest treatment that satisfies both "indicate which is active" (FR-002) and quick recognition. This was an explicit correction made during review: an initial code-only pill ("EN ▾") was rejected in favor of flag + full name.
- Placed **before** the theme toggle (not after) — the language choice is the more deliberate, occasionally-changed setting; the theme toggle is the quick, frequently-flipped one, so the cluster reads left-to-right roughly in "how often you touch this" order, ending in sign-out.
- Same control, same relative position, on the unauthenticated header (sign-in, etc.) — no sign-out/name/badge to sit alongside, same as the theme toggle's existing unauthenticated placement.
- **Responsive**: on mobile, the pill drops its text label and keeps only the flag (plus chevron), the same collapsing treatment the sidebar already applies to `.app-brand__name` and nav labels — keeps the header cluster from crowding on a narrow viewport.
- **Interaction**: selecting a menu option re-renders every visible translatable string on the current screen immediately — sidebar nav labels, header crumb/title, role badge, sign-out label, and page content — with no page reload (FR-003). Demonstrated in the mockup with a real (if simplified) EN/DE dictionary swap driving `[data-i18n]` elements, standing in for the real `I18nService` signal + `translate` pipe.

### Email correspondence language setting (US2)

Lives on **Settings › Preferences** (not Settings › Profile) — it's the first real content on that tab, which today is only a "Coming soon" placeholder card. This was an explicit placement correction made during review (an initial draft put it on the Profile tab, next to Identity/password).

```
Preferences
├── Language
│   ├── [ Email correspondence language ▾ ]  (select: "Use default (English)" | English | Deutsch)
│   ├── hint: "Used for future automated emails … independent of the display language …"
│   └── fallback note (shown only while unset): "Not set yet — correspondence will use
│       Vaultfolio's default language, English."
└── (existing "Coming soon" placeholder — account/currency/notification settings — unchanged)
```

- Same `SUPPORTED_LANGUAGES` list as the header switcher, in a standard `<select>`-style dropdown consistent with this codebase's existing form controls (FR-012).
- A distinct top option, "Use default (English)", represents the unset/`null` state (research.md #3/#4) — selecting an actual language clears the fallback note and represents an explicit choice (FR-008/FR-009).
- The fallback note disappears the moment a real language is chosen, and reappears if reset back to "Use default" — demonstrated live in the mockup — making the independence from the display language (FR-009) and the fallback behavior (FR-008) both visible without needing a second screen state.
- No mention of the header switcher's current value anywhere in this field — the two settings are visually and structurally unconnected, matching FR-009's independence requirement.

### Responsive behavior

No sidebar/layout changes beyond the header pill's mobile collapse described above — Settings › Preferences is a single-column form, already responsive as part of the existing settings screen.

## Requirement traceability

| Spec item | How the mockup addresses it                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001    | The language switcher pill, present in the header on every screen.                                                                           |
| FR-002    | Dropdown menu lists every supported language with a checkmark on the active one.                                                             |
| FR-003    | Live click-to-switch demo re-renders nav/header/content text with no reload.                                                                 |
| FR-004    | (Not a visual concern — persistence is behavioral, not shown in the mockup.)                                                                 |
| FR-005    | Mockup's default state is English, the catalog's `isDefault` entry.                                                                          |
| FR-006    | Dedicated "Email correspondence language" field on Settings › Preferences, visually separate from the header switcher.                       |
| FR-008    | Fallback note, shown only while unset, states the default-language behavior explicitly.                                                      |
| FR-009    | Switching the header language during the walkthrough leaves the Preferences field's selection/fallback-note state untouched, and vice versa. |
| FR-012    | Both controls draw from the same language list (flag + name), same order.                                                                    |

## Out of scope for this mockup

- Persistence across visits/devices (FR-004, FR-007) — behavioral, not a distinct visual state.
- The actual translated dictionaries for every real screen (US3/FR-011) — a content-completeness concern, not layout; the mockup only demonstrates the mechanism on one representative screen (dashboard).
- The rest of the Settings › Preferences "Coming soon" placeholder (account/currency/notification settings) — unchanged by this feature.
- The existing Identity/password/Danger Zone cards on Settings › Profile — untouched by this feature, not shown in the mockup.

## Visual language note

Approximates PrimeNG's Aura preset defaults (same tokens as `specs/010-theme-switch/mockup.html` and the real `apps/frontend` components today — indigo primary, neutral surfaces) since that's what's actually wired up in the app. The language-switcher pill and its dropdown menu are a new pattern (no direct PrimeNG precedent in this codebase yet); the real implementation should use a PrimeNG overlay/menu component (e.g. `p-select` or a `p-button` + `p-menu` pair) styled to match, rather than the mockup's hand-rolled `<div>`/JS dropdown.
