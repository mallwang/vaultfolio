import type { LanguageCode } from '@vaultfolio/api-contract';
import { de, en, type TranslationDictionary } from '@vaultfolio/frontend-shared-ui';

export interface ReminderPreview {
  subject: string;
  greeting: string;
  body: string;
  link: string;
  signature: string;
  footer: string;
}

/** Wording of the `insurance-deadline-reminder` e-mail templates (libs/notifications), per e-mail language. */
const WORDING: Record<LanguageCode, (name: string, type: string, date: string) => ReminderPreview> =
  {
    de: (name, type, date) => ({
      subject: `Kündigungsfrist für "${name}" am ${date}`,
      greeting: 'Hallo,',
      body: `Die Kündigungsfrist deiner Versicherung "${name}" (${type}) endet am ${date}. Wenn du sie kündigen möchtest, tu das bis zu diesem Datum.`,
      link: 'Zu den Versicherungen',
      signature: 'Dein Vaultfolio-Team',
      footer:
        'Dies ist eine automatisch generierte Nachricht von Vaultfolio — bitte antworten Sie nicht auf diese E-Mail.',
    }),
    en: (name, type, date) => ({
      subject: `Cancellation deadline for "${name}" on ${date}`,
      greeting: 'Hello,',
      body: `The cancellation deadline of your insurance "${name}" (${type}) is on ${date}. If you want to cancel it, do so by this date.`,
      link: 'Open Insurances',
      signature: 'The Vaultfolio Team',
      footer: 'This is an automated message from Vaultfolio — please do not reply to this email.',
    }),
  };

function typeLabel(typeId: string, language: LanguageCode): string {
  const types = (
    (language === 'de' ? de : en)['insurances'] as TranslationDictionary | undefined
  )?.['types'] as TranslationDictionary | undefined;
  const label = types?.[typeId];
  return typeof label === 'string' ? label : typeId;
}

export function buildReminderPreview(
  language: LanguageCode,
  contract: { name: string; type: string },
  deadline: string,
): ReminderPreview {
  return WORDING[language](contract.name, typeLabel(contract.type, language), deadline);
}
