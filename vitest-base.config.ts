import { defineConfig } from 'vitest/config';

// Picked up by every `@angular/build:unit-test` project (nx.json targetDefaults sets
// `runnerConfig: true`, which makes Angular's builder search for this file in the
// project root, then here). Coverage instrumentation adds real per-test overhead —
// on CI runners, a couple of router/HTTP-heavy specs (app.routes.spec.ts,
// dashboard.component.spec.ts) were flaking past Vitest's 5s default only when
// `--coverage` was on. Raise the ceiling instead of trimming margins per spec file.
export default defineConfig({
  test: {
    testTimeout: 15000,
    coverage: {
      exclude: [
        '**/main.ts',
        '**/app.config.ts',
        '**/app.routes.ts',
        '**/*-placeholder.component.ts',
        '**/application-areas.ts',
      ],
    },
  },
});
