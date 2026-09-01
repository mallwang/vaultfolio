import * as fs from 'node:fs';
import { sep } from 'node:path';
import { renderNotification } from './notification-renderer.js';

/**
 * Contract tests against the real `.hbs` files under `templates/`/`partials/`
 * (Principle IV — real serialization formats, not in-memory strings).
 */
describe('renderNotification', () => {
  // --- US1: correct per-language rendering + fallback (contracts/notifications-lib.md §1.2) ---

  it('renders German content when de files exist for the type', () => {
    const result = renderNotification({
      type: 'password-reset',
      preferredLanguage: 'de',
      viewModel: { resetUrl: 'https://vaultfolio.example.com/account/reset-password/tok123' },
    });

    expect(result.language).toBe('de');
    expect(result.subject).toBe('Setze dein Vaultfolio-Passwort zurück');
    expect(result.html).toContain('Passwort zurücksetzen');
    expect(result.text).toContain('Passwort zurücksetzen');
  });

  it('renders English content when preferredLanguage is null', () => {
    const result = renderNotification({
      type: 'password-reset',
      preferredLanguage: null,
      viewModel: { resetUrl: 'https://vaultfolio.example.com/account/reset-password/tok123' },
    });

    expect(result.language).toBe('en');
    expect(result.subject).toBe('Reset your Vaultfolio password');
  });

  it('renders English content when preferredLanguage is unsupported', () => {
    const result = renderNotification({
      type: 'password-reset',
      preferredLanguage: 'fr',
      viewModel: { resetUrl: 'https://vaultfolio.example.com/account/reset-password/tok123' },
    });

    expect(result.language).toBe('en');
    expect(result.subject).toBe('Reset your Vaultfolio password');
  });

  it('never returns an empty subject/html/text (FR-007)', () => {
    const result = renderNotification({
      type: 'signup-rejection',
      preferredLanguage: 'de',
      viewModel: {},
    });

    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.html.length).toBeGreaterThan(0);
    expect(result.text.length).toBeGreaterThan(0);
  });

  // --- US2: template-only wording change contract (SC-003, SC-006) ---

  it('matches the known rendered subject/body for a fixture template exactly — a future wording change updates only this fixture, not renderer code', () => {
    const result = renderNotification({
      type: 'password-reset',
      preferredLanguage: 'en',
      viewModel: { resetUrl: 'https://vaultfolio.example.com/account/reset-password/tok123' },
    });

    expect(result.subject).toBe('Reset your Vaultfolio password');
    expect(result.html).toBe(
      '<p>Vaultfolio</p>\n' +
        '<p>Hello,</p>\n' +
        '<p>We received a request to reset your Vaultfolio password.</p>\n' +
        '<p><a href="https://vaultfolio.example.com/account/reset-password/tok123">Reset your password</a></p>\n' +
        "<p>If you didn't request this, you can safely ignore this email.</p>\n" +
        '<p>The Vaultfolio Team</p>\n' +
        '<hr>\n' +
        '<p style="font-size:12px;color:#888">This is an automated message from Vaultfolio — please do not reply to this email.</p>\n',
    );
    // Handlebars trims the newline around a "standalone" partial reference
    // (one alone on its own line) — `header`/`salutation`/`signature`/
    // `footer` are standalone in the text template, so no blank line
    // survives around them; blank lines written directly in the template
    // (around the reset-link/disclaimer paragraphs) are preserved as-is.
    expect(result.text).toBe(
      'Vaultfolio\n' +
        'Hello,\n' +
        'We received a request to reset your Vaultfolio password.\n' +
        '\n' +
        'Reset your password: https://vaultfolio.example.com/account/reset-password/tok123\n' +
        '\n' +
        "If you didn't request this, you can safely ignore this email.\n" +
        '\n' +
        'The Vaultfolio Team\n' +
        '---\n' +
        'This is an automated message from Vaultfolio — please do not reply to this email.',
    );
  });

  it('propagates one shared partial edit to every notification type that includes it (SC-006)', () => {
    const passwordReset = renderNotification({
      type: 'password-reset',
      preferredLanguage: 'en',
      viewModel: { resetUrl: 'https://example.com/reset' },
    });
    const invitation = renderNotification({
      type: 'invitation',
      preferredLanguage: 'en',
      viewModel: { acceptUrl: 'https://example.com/invite' },
    });

    const footerContent = fs.readFileSync(`${__dirname}/partials/footer/en.hbs`, 'utf-8').trim();

    expect(passwordReset.html).toContain(footerContent);
    expect(invitation.html).toContain(footerContent);
  });

  // --- US3: no per-language branching, partial-rollout fallback (SC-004) ---

  it.each(['en', 'de'] as const)(
    'renders %s through the same code path with no per-language branching',
    (lang) => {
      const result = renderNotification({
        type: 'invitation',
        preferredLanguage: lang,
        viewModel: { acceptUrl: 'https://example.com/invite/abc' },
      });

      expect(result.language).toBe(lang);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    },
  );

  it('falls back to English for a type whose files are missing for an otherwise-supported language (partial rollout)', () => {
    const missingDeMarker = `${sep}invitation${sep}de.`;
    const spy = jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes(missingDeMarker)) {
        return false;
      }
      return jest.requireActual<typeof fs>('node:fs').existsSync(path);
    });

    try {
      const result = renderNotification({
        type: 'invitation',
        preferredLanguage: 'de',
        viewModel: { acceptUrl: 'https://example.com/invite/abc' },
      });

      expect(result.language).toBe('en');
      expect(result.subject).toBe("You're invited to Vaultfolio");
    } finally {
      spy.mockRestore();
    }
  });
});
