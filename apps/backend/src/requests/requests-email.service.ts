import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@vaultfolio/api-contract';
import { resolveLanguage, renderNotification } from '@vaultfolio/notifications';
import { findRequestType, requestTypeLabel } from '@vaultfolio/requests';
import { UsersRepository } from '../auth/users.repository';
import { requireAbsoluteUrl } from '../mail/absolute-url';
import { MailerService } from '../mail/mailer.service';

/**
 * Outbound mail of the requests capability (033, FR-034–FR-036). Link only: no attachment, no
 * sample content, no figures. Mail is best effort — nothing here throws, a failure is logged with
 * ids only so a submit or a status change never fails because of a mail problem.
 */
@Injectable()
export class RequestsEmailService {
  private readonly logger = new Logger(RequestsEmailService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly mailer: MailerService,
  ) {}

  /** One alert per active administrator, each in that administrator's language. */
  async notifyAdmins(request: { id: string; feature: string; type: string }): Promise<void> {
    try {
      const requestUrl = requireAbsoluteUrl(`/app/admin/requests?id=${request.id}`);
      const admins = await this.users.findAllByRole(UserRole.ADMIN);
      if (admins.length === 0) {
        this.logger.warn({ event: 'RequestMailNoAdmin', requestId: request.id });
        return;
      }
      const results = await Promise.allSettled(
        admins.map((admin) =>
          this.mailer.send({
            to: admin.email,
            ...renderNotification({
              type: 'request-admin-alert',
              preferredLanguage: admin.emailLanguage,
              viewModel: { ...this.names(request, admin.emailLanguage), requestUrl },
            }),
          }),
        ),
      );
      this.logFailures('request-admin-alert', request.id, results);
    } catch (error) {
      this.logFailure('request-admin-alert', request.id, error);
    }
  }

  /** The "done" mail to the requester, with a link back to the import page. */
  async notifyDone(
    requesterId: string,
    request: { id: string; feature: string; type: string },
  ): Promise<void> {
    try {
      const requester = await this.users.findById(requesterId);
      if (!requester) return;
      const importUrl = requireAbsoluteUrl('/app/earnings/import');
      await this.mailer.send({
        to: requester.email,
        ...renderNotification({
          type: 'request-done',
          preferredLanguage: requester.emailLanguage,
          viewModel: { ...this.names(request, requester.emailLanguage), importUrl },
        }),
      });
    } catch (error) {
      this.logFailure('request-done', request.id, error);
    }
  }

  private names(
    request: { feature: string; type: string },
    preferredLanguage: string | null,
  ): { featureName: string; typeName: string } {
    const definition = findRequestType(request.feature, request.type);
    if (!definition) return { featureName: request.feature, typeName: request.type };
    const label = requestTypeLabel(
      definition,
      resolveLanguage(preferredLanguage) === 'de' ? 'de' : 'en',
    );
    return { featureName: label.feature, typeName: label.type };
  }

  private logFailures(type: string, requestId: string, results: PromiseSettledResult<unknown>[]) {
    for (const result of results) {
      if (result.status === 'rejected') this.logFailure(type, requestId, result.reason);
    }
  }

  /** Metadata only: never the recipient address, the sample or the request content. */
  private logFailure(type: string, requestId: string, error: unknown): void {
    this.logger.error({
      event: 'RequestMailFailed',
      type,
      requestId,
      reason: error instanceof Error ? error.name : 'unknown',
    });
  }
}
