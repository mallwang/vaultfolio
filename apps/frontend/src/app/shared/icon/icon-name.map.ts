/**
 * Semantic icon name -> Material Symbols Outlined glyph name.
 *
 * Keys are the semantic names used at call sites (`<app-icon name="trash">`),
 * kept stable across the codebase and matching the old PrimeIcons suffix
 * where practical to minimize churn during the PrimeIcons -> Material
 * Symbols rewrite (data-model.md "Icon Name Map").
 *
 * Values must be valid ligature names in the Material Symbols Outlined
 * variable font loaded in index.html.
 */
export const ICON_NAME_MAP: Record<string, string> = {
  home: 'home',
  briefcase: 'work',
  'chart-line': 'show_chart',
  'check-circle': 'check_circle',
  clock: 'schedule',
  cog: 'settings',
  contract: 'description',
  download: 'download',
  envelope: 'mail',
  warning: 'warning',
  inbox: 'inbox',
  key: 'key',
  lock: 'lock',
  moon: 'dark_mode',
  sun: 'light_mode',
  pencil: 'edit',
  plus: 'add',
  replay: 'replay',
  search: 'search',
  send: 'send',
  shield: 'shield',
  'sign-out': 'logout',
  spinner: 'progress_activity',
  close: 'close',
  trash: 'delete',
  upload: 'upload',
  'user-plus': 'person_add',
  'arrow-left': 'arrow_back',
  // Additional names discovered while converting call sites (T028).
  'chevron-down': 'expand_more',
  calendar: 'calendar_month',
  'sort-alt': 'unfold_more',
  'sort-up': 'arrow_upward',
  'sort-down': 'arrow_downward',
  info: 'info',
  ban: 'block',
};
