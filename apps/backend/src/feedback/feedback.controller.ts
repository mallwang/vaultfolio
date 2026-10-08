import { Body, Controller, Get, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { FeedbackQuota, SendFeedbackResponse } from '@vaultfolio/api-contract';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import { ErrorResponseDto } from '../openapi/dto/error-response';
import {
  FeedbackQuotaDto,
  SendFeedbackRequestDto,
  SendFeedbackResponseDto,
} from '../openapi/dto/feedback';
import { TurnstileAction } from '../turnstile/turnstile-action.decorator';
import { TurnstileGuard } from '../turnstile/turnstile.guard';
import { FeedbackAvailableGuard } from './feedback-available.guard';
import { FeedbackService } from './feedback.service';

/** `POST /feedback`, `GET /feedback/quota` (044). Any signed-in user; no domain entitlement. */
@ApiTags('feedback')
@ApiVaultfolioSessionAuth()
@Controller('feedback')
@UseGuards(FeedbackAvailableGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get('quota')
  @ApiOperation({ summary: 'Remaining feedback submissions in the rolling 24 h window.' })
  @ApiResponse({ status: 200, type: FeedbackQuotaDto })
  @ApiResponse({ status: 503, type: ErrorResponseDto, description: 'feedback_unavailable.' })
  quota(@CurrentUser() user: RequestUser): Promise<FeedbackQuota> {
    return this.feedback.quota(user.id);
  }

  @Post()
  @TurnstileAction('feedback')
  @UseGuards(TurnstileGuard)
  @ApiOperation({
    summary: 'Send feedback to the administrators.',
    description:
      'Requires a valid Cloudflare Turnstile token (see `turnstileToken`). A repeat of the same `attemptId` returns 200 with the original result and sends nothing.',
  })
  @ApiBody({ type: SendFeedbackRequestDto })
  @ApiResponse({ status: 201, type: SendFeedbackResponseDto })
  @ApiResponse({ status: 200, type: SendFeedbackResponseDto, description: 'Idempotent repeat.' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'validation_error.' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'bot_protection_failed.' })
  @ApiResponse({ status: 429, type: ErrorResponseDto, description: 'feedback_limit_reached.' })
  @ApiResponse({ status: 502, type: ErrorResponseDto, description: 'feedback_delivery_failed.' })
  @ApiResponse({ status: 503, type: ErrorResponseDto, description: 'feedback_unavailable.' })
  async send(
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SendFeedbackResponse> {
    const result = await this.feedback.send(user, body);
    res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.body;
  }
}
