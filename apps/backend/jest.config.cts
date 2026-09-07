const { readFileSync } = require('node:fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'backend',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testEnvironmentOptions: {
    env: {
      BOOTSTRAP_ADMIN_EMAIL: 'admin@test.local',
      BOOTSTRAP_ADMIN_PASSWORD: 'test-password-123',
    },
  },
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['**/?(*.)+(spec|test|e2e-spec).[jt]s?(x)'],
  coverageDirectory: '../../coverage/apps/backend',
};
