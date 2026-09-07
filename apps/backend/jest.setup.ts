import { Logger } from '@nestjs/common';

// Silence all NestJS Logger output in tests — services log expected audit
// events (SMTP failures, state transitions) that are verified via mocks, not
// console output. Error-path tests are covered by assertions, not log noise.
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
  jest.spyOn(Logger, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
});
