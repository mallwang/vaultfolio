import { Module } from '@nestjs/common';
import { EarningsNewParserHandler } from './handlers/earnings-new-parser.handler';
import { REQUEST_TYPE_HANDLERS, type RequestTypeHandler } from './request-type-handler';
import { RequestsController } from './requests.controller';
import { RequestsRepository } from './requests.repository';
import { RequestsService } from './requests.service';

/**
 * Generic requests capability (033). Per-type behaviour is registered through the
 * `REQUEST_TYPE_HANDLERS` token: a new feature adds a handler to this list and a row to the
 * `@vaultfolio/requests` registry.
 */
@Module({
  controllers: [RequestsController],
  providers: [
    RequestsRepository,
    RequestsService,
    EarningsNewParserHandler,
    {
      provide: REQUEST_TYPE_HANDLERS,
      useFactory: (earnings: EarningsNewParserHandler): RequestTypeHandler[] => [earnings],
      inject: [EarningsNewParserHandler],
    },
  ],
  exports: [RequestsRepository],
})
export class RequestsModule {}
