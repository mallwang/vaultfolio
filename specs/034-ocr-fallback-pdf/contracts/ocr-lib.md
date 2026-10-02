# Contract: Recognition Library (browser, `libs/frontend/domain/earnings`)

Internal TypeScript contract between the import / parser-request flows and the OCR adapter. No new HTTP endpoints.

## `TextRecogniser` (port, injectable; real adapter + test fake)

```ts
export interface TextRecogniser {
  /** Renders and recognises the PDF; resolves with text or an error. Never rejects. */
  recognise(
    file: Blob,
    options: { signal: AbortSignal; onProgress: (p: RecognitionProgress) => void },
  ): Promise<RecognitionResult>;
}
```

Guarantees:

- Runs fully on the device; loads engine, worker and German data only from same-origin `assets/tesseract/**` (no CDN, no persistent cache); loaded lazily on first call.
- `signal` abort ⇒ worker terminated, canvases released, resolves `{ error: 'CANCELLED' }`.
- Output text has `origin: 'RECOGNISED'`, coordinates in PDF points with y growing upward, lines sorted top to bottom, words left to right.
- Refuses with `TOO_MANY_PAGES` above the page limit (5) before any rendering; `ENGINE_UNAVAILABLE` if assets/WASM cannot be loaded.
- Does not log or emit document content.

## Changes to existing contracts

| Where                                              | Change                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extractPdfText()`                                 | unchanged; callers receive `IMAGE_ONLY` and then offer recognition.                                                                                                                                                                                                          |
| `ImportSessionStore`                               | per-file state `awaitingRecognitionConsent \| recognising(progress) \| …`; actions `acceptRecognition(fileId)`, `declineRecognition(fileId)`, `cancelRecognition(fileId)`; after success runs the normal parse pipeline and sets `recognisedText = true` on the file's rows. |
| Import preview rows                                | show a "read via text recognition – please double-check" notice; included in the saved payload as `recognisedText`.                                                                                                                                                          |
| `ParserRequestStore`                               | same consent/progress steps before analysis; recognised text feeds `layout-extractor`/`personal-data` with `lenient` scan; preview step shows the "recognised automatically, may contain errors" notice.                                                                     |
| `scanLine`/`scanDocument` (`@vaultfolio/earnings`) | optional `{ lenient: boolean }`; lenient = shape-based matching without check digits for IBAN, tax ID, social-security number (see research R6). Strict remains the default and the only mode on the server.                                                                 |
| API `EarningsImportFile`                           | `recognisedText?: boolean` (see data-model.md).                                                                                                                                                                                                                              |

## Error message mapping

| Situation                      | Message                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| declined, cancelled, `NO_TEXT` | existing `IMAGE_ONLY` text ("no automatically readable text") |
| `TOO_MANY_PAGES`               | new: names the page limit                                     |
| `ENGINE_UNAVAILABLE`           | new: recognition could not be started on this device          |

All new strings: DE + EN in `earnings.{de,en}.ts` / `requests.{de,en}.ts` (checked by `earnings-translations.spec.ts`).
