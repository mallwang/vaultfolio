import { Controller, Get, Header } from '@nestjs/common';
import { dump } from 'js-yaml';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { getOpenApiDocument } from './openapi.setup';

/**
 * Serves the generated OpenAPI document as YAML at `GET /openapi.yml`
 * (reachable as `GET /api/openapi.yml` through the frontend's nginx proxy —
 * research.md #3). `@Public()` — the specification document itself is not
 * sensitive, only shape (research.md #5). `@ApiExcludeController` keeps this
 * meta-route itself out of the generated document.
 */
@ApiExcludeController()
@Controller()
export class OpenApiController {
  @Public()
  @Get('openapi.yml')
  @Header('Content-Type', 'text/yaml')
  getOpenApiYaml(): string {
    // Same OpenAPIObject `setupOpenApi` built at bootstrap for /swagger —
    // one in-code source of truth (data-model.md's API Specification
    // Document, research.md #3).
    return dump(getOpenApiDocument());
  }
}
