import { InjectionToken } from '@angular/core';
import { createTesseractRecogniser } from './tesseract-recogniser';
import type { TextRecogniser } from './text-recogniser';

/** The on-device recogniser; specs provide a `FakeTextRecogniser` instead. */
export const TEXT_RECOGNISER = new InjectionToken<TextRecogniser>('TEXT_RECOGNISER', {
  providedIn: 'root',
  factory: () => createTesseractRecogniser(),
});
