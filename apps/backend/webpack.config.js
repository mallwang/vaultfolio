const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('node:path');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: [
        './src/assets',
        // Notification `.hbs` templates/partials are loaded from disk at
        // runtime (file-existence-driven rendering, US3) — copy them
        // alongside the bundle so `__dirname`-relative lookups in
        // notification-renderer.ts resolve the same way in dev and prod.
        {
          input: 'libs/notifications/src/lib/templates',
          glob: '**/*',
          output: 'templates',
        },
        {
          input: 'libs/notifications/src/lib/partials',
          glob: '**/*',
          output: 'partials',
        },
      ],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
      // NOTE (research.md #1): the @nestjs/swagger CLI plugin was tried here
      // as a supplementary code-gen aid, but wiring it into this app's
      // NxAppWebpackPlugin `transformers` option switches ts-loader out of
      // transpile-only mode and it then fails with "TypeScript emitted no
      // output" for this project's tsconfig — a build-breaking regression
      // for a feature the plugin only ever supplemented, never required
      // (every DTO field here already carries an explicit @ApiProperty()).
      // Left disabled; every openapi/dto/* class is fully hand-decorated
      // instead, so no schema detail actually depends on the plugin running.
    }),
  ],
};
