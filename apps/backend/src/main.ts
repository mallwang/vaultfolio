import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { JsonLoggerService } from './logger/json-logger.service';

async function bootstrap() {
  const logger = new JsonLoggerService();
  const app = await NestFactory.create(AppModule, { logger });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
