// Namespace import (not destructured) so `fs.existsSync` stays a live
// property lookup at call time — this lets tests intercept it with
// `jest.spyOn(fs, 'existsSync')` to simulate a partial-rollout gap (a
// destructured `const { existsSync }` would capture the original function
// once and be immune to a later spy).
import * as fs from 'node:fs';
import { join } from 'node:path';
import * as Handlebars from 'handlebars';
import { DEFAULT_LANGUAGE_CODE } from '@vaultfolio/api-contract';
import { resolveLanguage } from './language-resolution.js';
import type {
  LanguageCode,
  NotificationType,
  RenderedNotificationEmail,
  RenderNotificationRequest,
} from './types.js';

// `__dirname`-relative: in dev/test this is `libs/notifications/src/lib`
// (templates/partials live alongside this file); in the bundled backend
// build, `apps/backend/webpack.config.js` copies the same two directories
// next to the bundle so the same relative lookup resolves in both places.
const TEMPLATES_DIR = join(__dirname, 'templates');
const PARTIALS_DIR = join(__dirname, 'partials');

const PARTIAL_NAMES = ['header', 'footer', 'salutation', 'signature'] as const;

const compiledTemplateCache = new Map<string, HandlebarsTemplateDelegate>();
const registeredPartialKeys = new Set<string>();

function compiledTemplate(filePath: string): HandlebarsTemplateDelegate {
  const cached = compiledTemplateCache.get(filePath);
  if (cached) {
    return cached;
  }
  const source = fs.readFileSync(filePath, 'utf-8');
  const compiled = Handlebars.compile(source);
  compiledTemplateCache.set(filePath, compiled);
  return compiled;
}

/**
 * Registers the `<name>-<lang>` partial for every shared partial that has a
 * file for `lang`, the first time that language is needed (FR-005) — a
 * template file references its own language's partial by that literal name
 * (e.g. `{{> header-de}}`), so nothing further needs to vary at runtime.
 */
function registerPartialsForLanguage(lang: string): void {
  for (const name of PARTIAL_NAMES) {
    const key = `${name}-${lang}`;
    if (registeredPartialKeys.has(key)) {
      continue;
    }
    const filePath = join(PARTIALS_DIR, name, `${lang}.hbs`);
    if (fs.existsSync(filePath)) {
      Handlebars.registerPartial(key, fs.readFileSync(filePath, 'utf-8'));
    }
    // Marked seen either way — a partial genuinely absent for this language
    // shouldn't be re-stat'd on every render.
    registeredPartialKeys.add(key);
  }
}

interface TypeFilePaths {
  subject: string;
  html: string;
  text: string;
}

function typeFilePaths(type: NotificationType, lang: string): TypeFilePaths {
  const dir = join(TEMPLATES_DIR, type);
  return {
    subject: join(dir, `${lang}.subject.hbs`),
    html: join(dir, `${lang}.html.hbs`),
    text: join(dir, `${lang}.text.hbs`),
  };
}

function typeFilesExist(type: NotificationType, lang: string): boolean {
  const paths = typeFilePaths(type, lang);
  return fs.existsSync(paths.subject) && fs.existsSync(paths.html) && fs.existsSync(paths.text);
}

/**
 * Renders a notification's subject/HTML/text for the recipient's resolved
 * language, independently falling back to `DEFAULT_LANGUAGE_CODE`'s files
 * for `type` when the resolved language has none (FR-002/FR-003) —
 * file-existence driven, no per-language branching, so a new language needs
 * no changes here (US3). Only throws if the English fallback files for
 * `type` are themselves missing/malformed, since English has no further
 * fallback.
 */
export function renderNotification(request: RenderNotificationRequest): RenderedNotificationEmail {
  const { type, preferredLanguage, viewModel } = request;
  const preferred = resolveLanguage(preferredLanguage);
  const renderLanguage: LanguageCode = typeFilesExist(type, preferred)
    ? preferred
    : DEFAULT_LANGUAGE_CODE;

  registerPartialsForLanguage(renderLanguage);
  const paths = typeFilePaths(type, renderLanguage);

  try {
    const subject = compiledTemplate(paths.subject)(viewModel).trim();
    const html = compiledTemplate(paths.html)(viewModel);
    const text = compiledTemplate(paths.text)(viewModel);
    return { type, language: renderLanguage, subject, html, text };
  } catch (error) {
    throw new Error(
      `Failed to render "${type}" notification templates for language "${renderLanguage}" ` +
        `(no further fallback available): ${(error as Error).message}`,
    );
  }
}
