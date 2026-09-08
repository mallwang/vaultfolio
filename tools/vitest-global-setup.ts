import { Blob as NodeBlob } from 'node:buffer';

// Global test setup for every `@angular/build:unit-test` project (picked up via
// `vitest-base.config.ts`'s `setupFiles`). jsdom does not implement `window.matchMedia`
// (029-export-data): PrimeNG's `TieredMenu` (used by `SplitButtonModule`, which
// `ExportControlComponent` — mounted on Holdings/Account Overview/every placeholder page —
// depends on) calls it unconditionally from `ngOnInit`, so any spec rendering that component
// tree needs a `matchMedia` implementation present before Angular's first change-detection pass,
// not a per-spec mock (`ThemeService`'s own spec already had one, scoped to just its own tests).
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom's `Blob` does not implement `arrayBuffer()`/`text()`
// (https://github.com/jsdom/jsdom/issues/2555) — 029-export-data's `libs/export` reads bytes
// back off every generated `Blob` (`full-export-archive.ts`'s ZIP assembly, in particular), which
// works fine in a real browser (the spec-required methods exist there) but throws under jsdom.
// Node's built-in `Blob` (`node:buffer`) is spec-compliant and byte-identical for this purpose, so
// swap it in for the test environment only.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  (globalThis as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;
}
