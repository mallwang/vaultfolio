import { Injectable } from '@nestjs/common';
import { RetirementRepository } from './retirement.repository';

/** Retirement use cases; the record/summary operations arrive with the user-story tasks. */
@Injectable()
export class RetirementService {
  constructor(readonly repository: RetirementRepository) {}
}
