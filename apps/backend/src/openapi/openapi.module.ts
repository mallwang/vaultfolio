import { Module } from '@nestjs/common';
import { OpenApiController } from './openapi.controller';

/** Registers `GET /openapi.yml` (T006). `setupOpenApi(app)` itself runs from `main.ts` at bootstrap, outside Nest's module graph. */
@Module({
  controllers: [OpenApiController],
})
export class OpenApiModule {}
