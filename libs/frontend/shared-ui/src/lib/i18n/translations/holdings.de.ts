import type { TranslationDictionary } from './en';

/**
 * Holdings texts (German), spread into the root dictionary so existing
 * key paths (`holdings.*`, `holdingsDistribution.*`, `holdingsArea.*`, `holdingsExport.*`) stay valid.
 * `nav.holdings` and `pageTitle.holdings*` stay in the shared nav/pageTitle groups.
 */
export const holdingsDe: TranslationDictionary = {
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
    columnQuantity: 'Menge / Gewicht',
    columnPrice: 'Preis / Wert',
    columnPurchaseDate: 'Kaufdatum',
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
    imports: 'Importe',
  },
  holdingsExport: {
    title: 'Bestände',
    infobox:
      'Über diesen Export — Holdings. Holdings ist der zentrale Tracking-Bereich, in dem du deine Investmentpositionen über verschiedene Anlageklassen hinweg erfassen und verfolgen (ETF, Aktie, Edelmetall, Krypto, Festgeld/Tagesgeld). Diese Datei enthält alle aktuell in deiner Holdings-Liste vorhandenen Positionen.',
    columnAssetType: 'Typ',
    columnName: 'Anlage',
    columnIsin: 'ISIN',
    columnManagement: 'Verwaltung',
    columnQuantity: 'Menge',
    columnWeightGrams: 'Gewicht (Gramm)',
    columnPurchasePrice: 'Kaufpreis',
    columnCurrentValue: 'Aktueller Wert',
    columnPurchaseDate: 'Kaufdatum',
    chartDistribution: 'Portfolioaufteilung',
  },
};
