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
    columnQuantity: 'Quantity / weight',
    columnPrice: 'Price / value',
    columnPurchaseDate: 'Purchase date',
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
    imports: 'Imports',
  },
  holdingsExport: {
    title: 'Holdings',
    infobox:
      'About this export — Holdings. Holdings is the primary tracking domain, letting you record and monitor your investment positions across asset types (ETF, Share, Precious Metal, Crypto, Deposit Money). This file contains every holding currently on your Holdings list.',
    columnAssetType: 'Type',
    columnName: 'Asset',
    columnIsin: 'ISIN',
    columnManagement: 'Management',
    columnQuantity: 'Quantity',
    columnWeightGrams: 'Weight (grams)',
    columnPurchasePrice: 'Purchase price',
    columnCurrentValue: 'Current value',
    columnPurchaseDate: 'Purchase date',
    chartDistribution: 'Portfolio Distribution',
  },
};
