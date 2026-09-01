const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

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
    }),
  ],
};
