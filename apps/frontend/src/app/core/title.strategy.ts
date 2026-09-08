import { inject, Injectable } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { I18nService } from '@vaultfolio/frontend-shared-ui';

/**
 * Prefixes every route's resolved `title` (see app.routes.ts) with the
 * product name, so the browser tab reads "Vaultfolio - <Page>" instead of
 * the bare Angular project name. Route titles are i18n key paths resolved
 * via `I18nService.translate()` at navigation time, so the tab title
 * reflects the language stored in localStorage on load and on every
 * in-app navigation. Routes without a `title` fall back to "Vaultfolio".
 */
@Injectable()
export class VaultfolioTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    const label = key ? this.i18n.translate(key) : undefined;
    this.title.setTitle(label ? `Vaultfolio - ${label}` : 'Vaultfolio');
  }
}
