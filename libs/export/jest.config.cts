const { readFileSync } = require('node:fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'export',
  preset: '../../jest.preset.js',
  // `libs/export` is framework-independent and touches no DOM (chart-image capture happens in
  // the Angular export-control component, not here) — `node` avoids a jsdom cross-realm bug
  // where ArrayBuffer/Blob objects crossing jsdom's separate VM context fail `instanceof`
  // checks inside exceljs/jszip. Node's global Blob is already spec-compliant.
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
