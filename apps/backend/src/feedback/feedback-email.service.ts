import { Injectable, Logger } from '@nestjs/common';
import { UserRole, type FeedbackCategory, type FeedbackLanguage } from '@vaultfolio/api-contract';
import { renderNotification, resolveLanguage } from '@vaultfolio/notifications';
import { UsersRepository } from '../auth/users.repository';
import { MailerService } from '../mail/mailer.service';
import { FeedbackDeliveryFailedException } from './feedback.exceptions';

const CATEGORY_LABELS: Record<'en' | 'de', Record<FeedbackCategory, string>> = {
  en: { feature: 'Feature request', problem: 'Problem', other: 'Other' },
  de: { feature: 'Funktionswunsch', problem: 'Problem', other: 'Sonstiges' },
};

const LANGUAGE_LABELS: Record<'en' | 'de', Record<FeedbackLanguage, string>> = {
  en: { de: 'German', en: 'English' },
  de: { de: 'deutsch', en: 'englisch' },
};

export interface FeedbackMail {
  id: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  senderName: string;
  senderEmail: string;
  senderLanguage: FeedbackLanguage;
}

/**
 * Delivers one feedback mail per active administrator, each in that administrator's language.
 * Unlike the best-effort requests mails, a failure throws: the user must know the feedback did not
 * arrive. Logs carry ids, category and counts only, never content or addresses.
 */
@Injectable()
export class FeedbackEmailService {
  private readonly logger = new Logger(FeedbackEmailService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly mailer: MailerService,
  ) {}

  async deliver(mail: FeedbackMail): Promise<void> {
    const admins = await this.users.findAllByRole(UserRole.ADMIN);
    if (admins.length === 0) {
      this.logger.error({ event: 'FeedbackMailNoAdmin', feedbackId: mail.id });
      throw new FeedbackDeliveryFailedException();
    }
    const results = await Promise.allSettled(
      admins.map((admin) => {
        const lang = resolveLanguage(admin.emailLanguage) === 'de' ? 'de' : 'en';
        return this.mailer.send({
          to: admin.email,
          ...renderNotification({
            type: 'feedback-admin-notice',
            preferredLanguage: admin.emailLanguage,
            recipient: admin.email,
            viewModel: {
              categoryLabel: CATEGORY_LABELS[lang][mail.category],
              subject: mail.subject,
              message: mail.message,
              senderName: mail.senderName,
              senderEmail: mail.senderEmail,
              senderLanguage: LANGUAGE_LABELS[lang][mail.senderLanguage],
            },
          }),
        });
      }),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      this.logger.error({
        event: 'FeedbackMailFailed',
        feedbackId: mail.id,
        category: mail.category,
        failed,
        total: admins.length,
      });
      throw new FeedbackDeliveryFailedException();
    }
  }
}
