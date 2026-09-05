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
  home: 'view_timeline',
  briefcase: 'empty_dashboard',
  'chart-line': 'finance',
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
  pencil: 'edit_note',
  plus: 'note_stack_add',
  replay: 'replay',
  save: 'save',
  search: 'search',
  send: 'send',
  shield: 'security',
  'sign-out': 'door_open',
  spinner: 'progress_activity',
  close: 'close',
  trash: 'delete',
  'contract-delete': 'contract_delete',
  upload: 'upload_file',
  'user-plus': 'signature',
  'arrow-left': 'arrow_back',
  // Additional names discovered while converting call sites (T028).
  'chevron-down': 'expand_more',
  'chevron-left': 'chevron_left',
  'chevron-right': 'chevron_right',
  calendar: 'calendar_month',
  'sort-alt': 'unfold_more',
  'sort-up': 'arrow_upward',
  'sort-down': 'arrow_downward',
  info: 'info',
  ban: 'block',
  wallet: 'account_balance_wallet',
  'trending-up': 'trending_up',
  // Asset-type selector icons (017-restructure-asset-types, design.md/mockup.html).
  building: 'apartment',
  diamond: 'diamond',
  'currency-bitcoin': 'currency_bitcoin',
  // Placeholder-domain nav icons (022-add-domain-placeholders, research.md #2).
  elderly: 'elderly',
  'receipt-long': 'receipt_long',
  'account-balance': 'account_balance',
};
