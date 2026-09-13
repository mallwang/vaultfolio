const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('node:path');

/**
 * Separate webpack config for `scripts/generate-openapi.ts` (T027), reusing
 * the exact same bundling approach as `webpack.config.js` (the main app) so
 * this script sees the same CJS/ESM interop between `apps/backend` (CJS-ish,
 * webpack "target: node") and the `@vaultfolio/*` libs (plain-ESM
 * TypeScript sources, per their own package.json `"type": "module"`) that
 * the real running backend does — running the raw `.ts` script directly
 * through `ts-node`/Node's own module resolution hits exactly that
 * CJS/ESM mismatch (mixed `require()` of ESM lib sources), since this
 * workspace's source is never executed unbundled outside of Jest (which
 * has its own SWC-based transform, not Node's loader).
 */
module.exports = {
  output: {
    path: join(__dirname, 'dist-openapi-script'),
    clean: true,
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './scripts/generate-openapi.ts',
      tsConfig: './tsconfig.app.json',
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: false,
    }),
  ],
};
