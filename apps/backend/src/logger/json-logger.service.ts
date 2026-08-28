import { ConsoleLogger, LogLevel } from '@nestjs/common';

/**
 * Structured (JSON) logger for the backend (FR-010, constitution Principle V).
 * Emits one JSON object per line to stdout so startup and request events are
 * machine-parseable from the first commit, instead of Nest's default
 * human-formatted console output.
 */
export class JsonLoggerService extends ConsoleLogger {
  protected override printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
  ): void {
    const timestamp = new Date().toISOString();

    for (const message of messages) {
      const line = {
        timestamp,
        level: logLevel ?? 'log',
        context: context ?? this.context,
        message:
          message instanceof Error
            ? { name: message.name, message: message.message, stack: message.stack }
            : message,
      };

      process.stdout.write(`${JSON.stringify(line)}\n`);
    }
  }
}
