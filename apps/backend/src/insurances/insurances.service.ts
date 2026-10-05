import { Injectable, Logger } from '@nestjs/common';
import type {
  InsuranceContract,
  InsurancesData,
  InsuranceSettings,
} from '@vaultfolio/api-contract';
import { MAX_CONTRACTS, validateContract, validateSettings } from '@vaultfolio/insurances';
import type { RequestUser } from '../auth/current-user.decorator';
import { InsurancesLinkedSocialService } from './insurances-linked-social.service';
import {
  InsurancesContractNotFoundException,
  InsurancesLimitExceededException,
  InsurancesValidationException,
} from './insurances.exceptions';
import { InsurancesRepository } from './insurances.repository';

/**
 * Insurances use cases (contracts/insurances-api.md). Bodies are validated by the strict
 * whitelist of `@vaultfolio/insurances`. Every call is scoped to `ownerId`; a foreign id behaves
 * like a missing id. Logs carry contract id, counts and outcome — never names, insurers, contract
 * numbers or amounts.
 */
@Injectable()
export class InsurancesService {
  private readonly logger = new Logger(InsurancesService.name);

  constructor(
    private readonly repository: InsurancesRepository,
    private readonly linkedSocial: InsurancesLinkedSocialService,
  ) {}

  data(user: RequestUser): InsurancesData {
    return {
      contracts: this.repository.list(user.id),
      linkedSocial: this.linkedSocial.linesFor(user),
      settings: this.repository.getSettings(user.id),
      today: new Date().toISOString().slice(0, 10),
    };
  }

  create(ownerId: string, body: unknown): InsuranceContract {
    const input = this.validate(body);
    if (this.repository.count(ownerId) >= MAX_CONTRACTS)
      throw new InsurancesLimitExceededException();
    const contract = this.repository.insert(ownerId, input);
    this.logger.log({ event: 'InsuranceContractCreated', id: contract.id });
    return contract;
  }

  update(ownerId: string, id: string, body: unknown): InsuranceContract {
    const input = this.validate(body);
    const before = this.repository.get(ownerId, id);
    if (!before) throw new InsurancesContractNotFoundException();
    const contract = this.repository.update(ownerId, id, input);
    if (!contract) throw new InsurancesContractNotFoundException();
    // A changed term or deadline makes earlier reminders obsolete (a new deadline may remind again).
    this.repository.clearReminders(ownerId, id);
    this.logger.log({ event: 'InsuranceContractUpdated', id });
    return contract;
  }

  delete(ownerId: string, id: string): void {
    if (!this.repository.delete(ownerId, id)) throw new InsurancesContractNotFoundException();
    this.logger.log({ event: 'InsuranceContractDeleted', id });
  }

  saveSettings(ownerId: string, body: unknown): InsuranceSettings {
    const result = validateSettings(body);
    if (!result.ok) throw new InsurancesValidationException(result.issues);
    const settings = this.repository.saveSettings(ownerId, result.value);
    this.logger.log({
      event: 'InsuranceSettingsSaved',
      remindersEnabled: settings.reminders.enabled,
      dismissed: settings.dismissedRequirements.length,
    });
    return settings;
  }

  deleteAll(ownerId: string): void {
    const count = this.repository.deleteAllForOwner(ownerId);
    this.logger.log({ event: 'InsurancesDeletedAll', count });
  }

  private validate(body: unknown) {
    const result = validateContract(body);
    if (!result.ok) throw new InsurancesValidationException(result.issues);
    return result.value;
  }
}
