import {
  BadRequestException,
  type INestApplication,
  PayloadTooLargeException,
} from '@nestjs/common';
import { json, type NextFunction, type Request, type Response, urlencoded } from 'express';

/** Default request-body limit for every route (Express's own default). */
export const DEFAULT_BODY_LIMIT = '100kb';
/** Import batches of the Earnings domain (≈170-record exports, 13-file years) exceed the default (research R7). */
export const EARNINGS_IMPORT_BODY_LIMIT = '5mb';

/** Parser-request submissions (anonymized layout data, research R5) exceed the default. */
export const REQUESTS_BODY_LIMIT = '512kb';

/**
 * Explicit body parsers replacing Nest's defaults (bootstrap with `bodyParser: false`): the raised
 * limits apply only to `/earnings/imports*` and `/requests`, every other route keeps 100 kB. The first parser that
 * reads a body marks it parsed, so the global parser skips requests the import parser handled.
 */
export function configureBodyParsers(app: INestApplication): void {
  app.use('/earnings/imports', json({ limit: EARNINGS_IMPORT_BODY_LIMIT }));
  app.use('/requests', json({ limit: REQUESTS_BODY_LIMIT }));
  app.use(json({ limit: DEFAULT_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: DEFAULT_BODY_LIMIT }));
  app.use(mapBodyParserErrors);
}

/**
 * body-parser rejects with plain errors (`type: 'entity.too.large'` / `'entity.parse.failed'`),
 * which the global filter would answer as 500; turn them into the matching 413 / 400.
 */
function mapBodyParserErrors(
  error: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const type = (error as { type?: unknown } | null)?.type;
  if (type === 'entity.too.large') {
    next(
      new PayloadTooLargeException({
        error: 'payload_too_large',
        message: 'The request body is too large.',
      }),
    );
  } else if (type === 'entity.parse.failed') {
    next(
      new BadRequestException({
        error: 'invalid_json',
        message: 'The request body is not valid JSON.',
      }),
    );
  } else {
    next(error);
  }
}
