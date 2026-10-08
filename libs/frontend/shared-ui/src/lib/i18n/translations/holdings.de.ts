import type { TranslationDictionary } from './en';

/**
 * Holdings texts (German), spread into the root dictionary so existing
 * key paths (`holdings.*`, `holdingsDistribution.*`, `holdingsArea.*`, `holdingsExport.*`) stay valid.
 * `nav.holdings` and `pageTitle.holdings*` stay in the shared nav/pageTitle groups.
 */
export const holdingsDe: TranslationDictionary = {
  holdingsTile: {
    purchaseValue: 'Kaufwert',
    excluded: '{{n}} ohne Kaufwert nicht berücksichtigt',
    emptyTitle: 'Noch keine Bestände',
    emptyBody: 'Lege deinen ersten Bestand an, um hier Kaufwert und Verteilung zu sehen.',
    emptyCta: 'Bestand hinzufügen',
    error: 'Bestände konnten nicht geladen werden.',
    unavailable: 'Bestände sind vorübergehend nicht verfügbar.',
    excludedNote: '{{n}} ausgeschlossen, kein Wert erfasst',
  },
  holdingsDistribution: {
    title: 'Verteilung nach Wert',
    emptyState:
      'Füge einen Bestand mit bekanntem Wert hinzu, um die Verteilung nach Wert zu sehen.',
  },
  holdings: {
    unavailable: {
      title: 'Bestände sind vorübergehend nicht verfügbar',
      body: 'Der Server kann die gespeicherten Bestände gerade nicht lesen. Nichts geht verloren – bitte versuche es später erneut oder wende dich an deinen Administrator.',
    },
    addHolding: 'Bestand hinzufügen',
    filterPlaceholder: 'Bestände durchsuchen',
    countSingular: 'Bestand',
    countPlural: 'Bestände',
    columnType: 'Typ',
    columnAsset: 'Anlage',
    columnManagement: 'Verwaltung',
    columnQuantity: 'Menge',
    columnPrice: 'Preis / Wert',
    columnPurchaseDate: 'Kaufdatum',
    showNote: 'Notiz anzeigen',
    editHolding: 'Bestand bearbeiten',
    deleteHolding: 'Bestand löschen',
    emptyStateTitle: 'Noch keine Bestände',
    emptyStateBody: 'Füge deinen ersten Bestand hinzu, um ihn hier zu sehen.',
    addFirstHolding: 'Ersten Bestand hinzufügen',
    loadError: 'Bestände konnten nicht geladen werden. Bitte versuche es erneut.',
    deleteConfirmHeader: 'Bestand löschen',
    deleteConfirmMessage:
      'Diesen {{assetType}}-Bestand ({{management}}) löschen? Dies kann nicht rückgängig gemacht werden.',
    delete: 'Löschen',
    deleted: 'Bestand gelöscht',
    alreadyDeleted: 'Bereits gelöscht',
    alreadyDeletedDetail: 'Dieser Bestand wurde bereits entfernt.',
    deleteError: 'Dieser Bestand konnte nicht gelöscht werden.',
  },
  holdingsArea: {
    list: 'Liste',
  },
  holdingsExport: {
    title: 'Bestände',
    infobox:
      'Über diesen Export — Holdings. Holdings ist der zentrale Tracking-Bereich, in dem du deine Investmentpositionen über verschiedene Anlageklassen hinweg erfassen und verfolgen (ETF, Aktie, Edelmetall, Krypto, Festgeld/Tagesgeld). Diese Datei enthält alle aktuell in deiner Holdings-Liste vorhandenen Positionen.',
    columnAssetType: 'Typ',
    columnName: 'Anlage',
    columnMetal: 'Metall',
    columnCoin: 'Coin',
    columnUnit: 'Einheit',
    columnNote: 'Notiz',
    columnIsin: 'ISIN',
    columnManagement: 'Verwaltung',
    columnQuantity: 'Menge',
    columnPurchasePrice: 'Kaufpreis',
    columnCurrentValue: 'Aktueller Wert',
    columnPurchaseDate: 'Kaufdatum',
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
