import type { TranslationDictionary } from './en';

/** `ocr.*` — consent, progress and notices of on-device text recognition, shared by Earnings and Retirement (Deutsch). */
export const ocrDe: TranslationDictionary = {
  badge: 'Texterkennung',
  statusDECISION: 'Entscheidung nötig',
  statusRECOGNISING: 'Wird gelesen …',
  noText: 'In dieser PDF wurde kein automatisch lesbarer Text gefunden.',
  offerInfo:
    'Das sieht nach einem Scan aus oder nach einer PDF, deren Text in Grafiken umgewandelt wurde. Die Texterkennung kann sie auf diesem Gerät lesen: Datei und Text bleiben in Ihrem Browser und werden nicht gespeichert. Ziffern können falsch gelesen werden, deshalb müssen Sie die Beträge prüfen.',
  accept: 'Text auf diesem Gerät lesen',
  pageCount: '{{count}} Seiten',
  decline: 'Jetzt nicht',
  lock: 'Funktioniert offline, nichts verlässt Ihr Gerät',
  cancel: 'Abbrechen',
  waiting: 'Wartet auf die vorherige Datei …',
  loading: 'Texterkennung wird vorbereitet …',
  rendering: 'Seite {{page}} von {{total}} wird vorbereitet …',
  page: 'Seite {{page}} von {{total}} wird gelesen',
  noticeTitle: 'Per Texterkennung gelesen',
  notice:
    'Der Text der markierten Dateien wurde per Texterkennung gelesen und kann Fehler enthalten, besonders bei Ziffern. Bitte prüfen Sie vor dem Import jeden Betrag anhand Ihres Dokuments.',
  instead: 'Text stattdessen auf diesem Gerät lesen',
  noParserNote:
    'Der Text dieser Datei wurde per Texterkennung gelesen. Sie können einen Parser für dieses Layout anfragen; der erkannte Text wird nicht erneut gelesen.',
  hintTooManyPages:
    'Die Texterkennung ist auf {{max}} Seiten pro Dokument begrenzt; dieses Dokument hat mehr.',
  hintEngineUnavailable: 'Die Texterkennung konnte auf diesem Gerät nicht gestartet werden.',
};
