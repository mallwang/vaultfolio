import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Every response carries the caller's personal data (or depends on who is asking): `no-store`
 * keeps it out of the browser's and any intermediary's cache, so nothing of one user's is left
 * behind on a shared device for the next one. A route may still set its own `Cache-Control`.
 */
export function configureNoStore(app: INestApplication): void {
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
}
