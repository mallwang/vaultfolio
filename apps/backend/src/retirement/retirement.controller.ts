import { Controller, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequiresDomain } from '../auth/domain.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import { ErrorResponseDto } from '../openapi/dto';
import { RetirementAvailableGuard } from './retirement-available.guard';
import { RetirementService } from './retirement.service';

/**
 * REST surface for `/retirement`, per contracts/retirement-api.md. `AuthGuard`/`DomainGuard` run
 * globally; `RetirementAvailableGuard` then fails every route closed with 503 without a usable
 * key. Every call reads and writes only the caller's own data. Request bodies are validated by
 * `@vaultfolio/retirement`'s strict whitelist, not by a DTO pipe.
 */
@ApiTags('retirement')
@ApiVaultfolioSessionAuth()
@Controller('retirement')
@RequiresDomain('retirement')
@UseGuards(RetirementAvailableGuard)
@ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Domain not entitled.' })
@ApiResponse({
  status: 503,
  type: ErrorResponseDto,
  description: 'RETIREMENT_UNAVAILABLE — key missing/invalid.',
})
export class RetirementController {
  constructor(readonly retirement: RetirementService) {}
}
