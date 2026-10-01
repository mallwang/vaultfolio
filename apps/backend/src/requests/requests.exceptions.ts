import {
  AccessDeniedException,
  type BusinessExceptionBody,
  RateLimitException,
  ResourceNotFoundException,
  ValidationException,
} from '@vaultfolio/observability';
import { HttpException } from '@nestjs/common';
import { RequestErrorCode } from '@vaultfolio/api-contract';

/** A rejected submission: carries only the code, a JSON path and fixed text — never submitted values (FR-016, FR-023). */
const MESSAGES: Record<string, string> = {
  [RequestErrorCode.UNKNOWN_REQUEST_TYPE]: 'This kind of request is not supported.',
  [RequestErrorCode.INVALID_LAYOUT]: 'The submitted layout is not valid.',
  [RequestErrorCode.LAYOUT_UNKNOWN_FIELD]: 'The submitted layout contains an unexpected field.',
  [RequestErrorCode.LIMIT_EXCEEDED]: 'The submitted layout exceeds a limit.',
  [RequestErrorCode.INVALID_RULE_DRAFT]: 'The submitted rule draft is not valid.',
  [RequestErrorCode.PERSONAL_DATA_DETECTED]: 'The submitted layout contains personal data.',
  [RequestErrorCode.INVALID_REQUEST_UPDATE]: 'The requested change is not valid.',
};

export function invalidSubmission(
  code: string,
  path?: string,
  details?: BusinessExceptionBody['details'],
): ValidationException {
  return new ValidationException({
    error: code,
    message: MESSAGES[code] ?? 'The request is not valid.',
    details: details ?? (path ? [{ field: path, message: code }] : undefined),
  });
}

export class RequestLimitOpenException extends RateLimitException {
  constructor() {
    super({
      error: RequestErrorCode.REQUEST_LIMIT_OPEN,
      message: 'There are already three open requests of this user.',
    });
  }
}

export class RequestLimitDailyException extends RateLimitException {
  constructor() {
    super({
      error: RequestErrorCode.REQUEST_LIMIT_DAILY,
      message: 'The daily limit of requests is reached.',
    });
  }
}

export class RequestNotFoundException extends ResourceNotFoundException {
  constructor() {
    super({ error: RequestErrorCode.REQUEST_NOT_FOUND, message: 'The request does not exist.' });
  }
}

/** 410: the sample was removed by the retention sweep. */
export class SampleDeletedException extends HttpException {
  constructor() {
    super({ error: RequestErrorCode.SAMPLE_DELETED, message: 'The sample has been deleted.' }, 410);
  }
}

export class RequestForbiddenException extends AccessDeniedException {
  constructor() {
    super({ error: 'forbidden', message: 'You do not have access to this resource.' });
  }
}

/** 415 for a body that is not JSON. */
export class UnsupportedMediaTypeBodyException extends HttpException {
  constructor() {
    super(
      { error: 'UNSUPPORTED_MEDIA_TYPE', message: 'The request body must be application/json.' },
      415,
    );
  }
}
