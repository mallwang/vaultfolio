import type { TranslationDictionary } from './en';

/** `ocr.*` — consent, progress and notices of on-device text recognition, shared by Earnings and Retirement (English). */
export const ocrEn: TranslationDictionary = {
  badge: 'Text recognition',
  statusDECISION: 'Needs your decision',
  statusRECOGNISING: 'Reading…',
  noText: 'No automatically readable text found in this PDF.',
  offerInfo:
    'This looks like a scan, or a PDF whose text was converted to graphics. Text recognition can read it on this device: the file and its text stay in your browser and are not stored. Digits can be misread, so you will need to check the figures.',
  accept: 'Read text on this device',
  pageCount: '{{count}} pages',
  decline: 'Not now',
  lock: 'Works offline, nothing leaves your device',
  cancel: 'Cancel',
  waiting: 'Waiting for the previous file…',
  loading: 'Preparing text recognition…',
  rendering: 'Preparing page {{page}} of {{total}}…',
  page: 'Reading page {{page}} of {{total}}',
  noticeTitle: 'Read via text recognition',
  notice:
    'The text of the marked files was read by text recognition and may contain errors, especially in digits. Please double-check every figure against your document before importing.',
  instead: 'Read text on this device instead',
  noParserNote:
    'The text of this file was read via text recognition. You can request a parser for this layout; the recognised text is not read again.',
  hintTooManyPages:
    'Text recognition is limited to {{max}} pages per document; this document has more.',
  hintEngineUnavailable: 'Text recognition could not be started on this device.',
};
