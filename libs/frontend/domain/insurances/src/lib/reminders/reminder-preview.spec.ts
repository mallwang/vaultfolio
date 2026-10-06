import { buildReminderPreview } from './reminder-preview';

const contract = { name: 'Haftpflicht', type: 'PRIVATE_LIABILITY' };

describe('buildReminderPreview', () => {
  it('builds the German mail with the German type label', () => {
    const mail = buildReminderPreview('de', contract, '30. September 2026');
    expect(mail.subject).toBe('Kündigungsfrist für "Haftpflicht" am 30. September 2026');
    expect(mail.body).toContain('(Privathaftpflicht)');
    expect(mail.greeting).toBe('Hallo,');
  });

  it('builds the English mail with the English type label', () => {
    const mail = buildReminderPreview('en', contract, 'September 30, 2026');
    expect(mail.subject).toBe('Cancellation deadline for "Haftpflicht" on September 30, 2026');
    expect(mail.body).toContain('is on September 30, 2026');
    expect(mail.signature).toBe('The Vaultfolio Team');
    expect(mail.body).toContain('(Private liability)');
  });

  it('falls back to the type id when the label is unknown', () => {
    const mail = buildReminderPreview('en', { name: 'X', type: 'UNKNOWN_TYPE' }, '1 Jan');
    expect(mail.body).toContain('(UNKNOWN_TYPE)');
  });
});
