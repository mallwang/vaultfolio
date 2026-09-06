const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  // Jest 30 no longer defaults to lcov; SonarQube needs the lcov format to import coverage.
  coverageReporters: ['lcov', 'text-summary'],
};
