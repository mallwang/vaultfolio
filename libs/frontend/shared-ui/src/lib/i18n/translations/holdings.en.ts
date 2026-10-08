import type { TranslationDictionary } from './en';

/**
 * Holdings texts (English), spread into the root dictionary so existing
 * key paths (`holdings.*`, `holdingsDistribution.*`, `holdingsArea.*`, `holdingsExport.*`) stay valid.
 * `nav.holdings` and `pageTitle.holdings*` stay in the shared nav/pageTitle groups.
 */
export const holdingsEn: TranslationDictionary = {
  holdingsDistribution: {
    title: 'Distribution by value',
    emptyState: 'Add a holding with a known value to see the distribution by value.',
  },
  holdings: {
    unavailable: {
      title: 'Holdings are temporarily unavailable',
      body: 'The server cannot read the stored holdings right now. Nothing is lost – please try again later or contact your administrator.',
    },
    addHolding: 'Add holding',
    filterPlaceholder: 'Search holdings',
    countSingular: 'holding',
    countPlural: 'holdings',
    columnType: 'Type',
    columnAsset: 'Asset',
    columnManagement: 'Management',
    columnQuantity: 'Quantity',
    columnPrice: 'Price / value',
    columnPurchaseDate: 'Purchase date',
    showNote: 'Show note',
    editHolding: 'Edit holding',
    deleteHolding: 'Delete holding',
    emptyStateTitle: 'No holdings yet',
    emptyStateBody: 'Add your first holding to see it listed here.',
    addFirstHolding: 'Add your first holding',
    loadError: 'Unable to load holdings. Please try again.',
    deleteConfirmHeader: 'Delete holding',
    deleteConfirmMessage:
      'Delete this {{assetType}} holding ({{management}})? This cannot be undone.',
    delete: 'Delete',
    deleted: 'Holding deleted',
    alreadyDeleted: 'Already deleted',
    alreadyDeletedDetail: 'This holding was already removed.',
    deleteError: 'Unable to delete this holding.',
  },
  holdingsArea: {
    list: 'List',
  },
  holdingsExport: {
    title: 'Holdings',
    infobox:
      'About this export — Holdings. Holdings is the primary tracking domain, letting you record and monitor your investment positions across asset types (ETF, Share, Precious Metal, Crypto, Deposit Money). This file contains every holding currently on your Holdings list.',
    columnAssetType: 'Type',
    columnName: 'Asset',
    columnMetal: 'Metal',
    columnCoin: 'Coin',
    columnUnit: 'Unit',
    columnNote: 'Note',
    columnIsin: 'ISIN',
    columnManagement: 'Management',
    columnQuantity: 'Quantity',
    columnPurchasePrice: 'Purchase price',
    columnCurrentValue: 'Current value',
    columnPurchaseDate: 'Purchase date',
    chartDistribution: 'Portfolio Distribution',
  },
  holdingMetal: {
    XAU: 'Gold',
    XAG: 'Silver',
    XPT: 'Platinum',
    XPD: 'Palladium',
  },
  holdingError: {
    REQUIRED: 'This field is required.',
    ISIN_INVALID: 'Enter a well-formed 12-character ISIN.',
    ISIN_NOT_ALLOWED: 'This ISIN cannot be used for this asset type.',
    METAL_UNKNOWN: 'Select one of the listed metals.',
    COIN_UNKNOWN: 'Select one of the listed coins.',
    UNIT_INVALID: 'Select gram or troy ounce.',
    QUANTITY_NOT_POSITIVE: 'Quantity must be greater than zero.',
    QUANTITY_DECIMALS: 'Quantity allows at most 8 decimal places.',
    NOTE_TOO_LONG: 'The note must not exceed 500 characters.',
    DECIMAL_INVALID:
      'Enter a valid, non-negative amount or a valid date that is not in the future.',
    FIELD_NOT_ALLOWED: 'This field is not allowed for this asset type.',
  },
};
