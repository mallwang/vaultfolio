import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';
import { JsonLoggerService } from './logger/json-logger.service';
import { setupOpenApi } from './openapi/openapi.setup';

async function bootstrap() {
  const logger = new JsonLoggerService();

  // Process-level failures happen outside any request (e.g. a rejected promise never awaited, or
  // a synchronous throw outside Nest's exception zone) and would otherwise be silently lost —
  // capture them via the same structured logger (FR-016).
  process.on('unhandledRejection', (reason) => {
    logger.error(
      'Unhandled promise rejection',
      reason instanceof Error ? reason.stack : reason,
      'Process',
    );
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error.stack, 'Process');
  });

  const app = await NestFactory.create(AppModule, { logger });
  app.use(cookieParser());
  setupOpenApi(app);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
