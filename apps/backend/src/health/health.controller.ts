import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { HealthStatus } from '@vaultfolio/api-contract';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Report backend/database health.' })
  @ApiResponse({
    status: 200,
    description: 'Database reachable.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'] },
        database: { type: 'string', enum: ['connected'] },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Database unreachable.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['degraded'] },
        database: { type: 'string', enum: ['unreachable'] },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthStatus> {
    const result = await this.healthService.check();
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
