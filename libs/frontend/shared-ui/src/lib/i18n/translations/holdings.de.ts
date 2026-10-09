import type { TranslationDictionary } from './en';

/**
 * Holdings texts (German), spread into the root dictionary so existing
 * key paths (`holdings.*`, `holdingsDistribution.*`, `holdingsExport.*`) stay valid.
 * `nav.holdings` and `pageTitle.holdings*` stay in the shared nav/pageTitle groups.
 */
export const holdingsDe: TranslationDictionary = {
  holdingsTile: {
    open: 'Zum Portfolio',
    emptyTitle: 'Noch keine Positionen',
    emptyBody: 'Lege deinen ersten Position an, um hier Kaufwert und Verteilung zu sehen.',
    emptyCta: 'Position hinzufügen',
    error: 'Positionen konnten nicht geladen werden.',
    unavailable: 'Positionen sind vorübergehend nicht verfügbar.',
    caption: 'Kaufwert inkl. Giralgeld',
  },
  holdingsDistribution: {
    title: 'Verteilung nach Wert',
    emptyState:
      'Füge einen Position mit bekanntem Wert hinzu, um die Verteilung nach Wert zu sehen.',
  },
  holdings: {
    unavailable: {
      title: 'Positionen sind vorübergehend nicht verfügbar',
      body: 'Der Server kann die gespeicherten Positionen gerade nicht lesen. Nichts geht verloren – bitte versuche es später erneut oder wende dich an deinen Administrator.',
    },
    addHolding: 'Position hinzufügen',
    filterPlaceholder: 'Positionen durchsuchen',
    countSingular: 'Position',
    countPlural: 'Positionen',
    chartsHide: 'Charts ausblenden',
    chartsShow: 'Charts einblenden',
    columnType: 'Typ',
    columnAsset: 'Anlage',
    columnManagement: 'Verwaltung',
    columnQuantity: 'Menge',
    columnPrice: 'Preis / Wert',
    columnTotal: 'Kaufsumme',
    footerTotal: 'Summe',
    footerTotalFiltered: 'Summe (gefiltert)',
    footerOfTotal: 'von',
    showNote: 'Notiz anzeigen',
    editHolding: 'Position bearbeiten',
    deleteHolding: 'Position löschen',
    emptyStateTitle: 'Noch keine Positionen',
    emptyStateBody: 'Füge deinen ersten Position hinzu, um ihn hier zu sehen.',
    addFirstHolding: 'Ersten Position hinzufügen',
    loadError: 'Positionen konnten nicht geladen werden. Bitte versuche es erneut.',
    deleteConfirmHeader: 'Position löschen',
    deleteConfirmMessage:
      'Diesen {{assetType}}-Position ({{management}}) löschen? Dies kann nicht rückgängig gemacht werden.',
    delete: 'Löschen',
    deleted: 'Position gelöscht',
    alreadyDeleted: 'Bereits gelöscht',
    alreadyDeletedDetail: 'Dieser Position wurde bereits entfernt.',
    deleteError: 'Dieser Position konnte nicht gelöscht werden.',
  },
  holdingsExport: {
    title: 'Portfolio',
    infobox:
      'Über diesen Export — Portfolio. Das Portfolio ist der zentrale Tracking-Bereich, in dem du deine Investmentpositionen über verschiedene Anlageklassen hinweg erfassen und verfolgen (ETF, Aktie, Edelmetall, Krypto, Festgeld/Tagesgeld). Diese Datei enthält alle aktuell in deinem Portfolio vorhandenen Positionen.',
    columnAssetType: 'Typ',
    columnName: 'Anlage',
    columnMetal: 'Metall',
    columnCoin: 'Coin',
    columnUnit: 'Einheit',
    columnNote: 'Notiz',
    columnIsin: 'ISIN',
    columnManagement: 'Verwaltung',
    columnQuantity: 'Menge',
    columnPurchasePrice: 'Ø Kaufpreis',
    columnCurrentValue: 'Aktueller Wert',
    columnPurchaseSum: 'Kaufsumme',
    total: 'Summe',
    cardsTitle: 'Übersicht',
    allPositions: 'Alle Positionen',
    columnShare: 'Anteil',
    columnAmount: 'Betrag',
    noPositions: 'Keine Positionen',
    chartDistribution: 'Portfolioaufteilung',
  },
  holdingMetal: {
    XAU: 'Gold',
    XAG: 'Silber',
    XPT: 'Platin',
    XPD: 'Palladium',
  },
  holdingError: {
    REQUIRED: 'Dieses Feld ist erforderlich.',
    ISIN_INVALID: 'Gib eine gültige 12-stellige ISIN ein.',
    ISIN_NOT_ALLOWED: 'Diese ISIN ist für diese Anlageart nicht zulässig.',
    METAL_UNKNOWN: 'Wähle eines der angebotenen Metalle.',
    COIN_UNKNOWN: 'Wähle einen der angebotenen Coins.',
    UNIT_INVALID: 'Wähle Gramm oder Feinunze.',
    QUANTITY_NOT_POSITIVE: 'Die Menge muss größer als null sein.',
    QUANTITY_DECIMALS: 'Die Menge erlaubt höchstens 8 Nachkommastellen.',
    NOTE_TOO_LONG: 'Die Notiz darf höchstens 500 Zeichen lang sein.',
    DECIMAL_INVALID:
      'Gib einen gültigen, nicht negativen Betrag oder ein gültiges Datum ein, das nicht in der Zukunft liegt.',
    FIELD_NOT_ALLOWED: 'Dieses Feld ist für diese Anlageart nicht zulässig.',
  },
};
