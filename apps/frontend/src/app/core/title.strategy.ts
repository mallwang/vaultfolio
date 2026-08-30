import { Injectable } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Title } from '@angular/platform-browser';

/**
 * Prefixes every route's resolved `title` (see app.routes.ts) with the
 * product name, so the browser tab reads "Vaultfolio - <Page>" instead of
 * the bare Angular project name. Routes without a `title` (there shouldn't
 * be any left, but a wildcard fallback is safer than a blank tab) fall back
 * to "Vaultfolio" alone.
 */
@Injectable()
export class VaultfolioTitleStrategy extends TitleStrategy {
  constructor(private readonly title: Title) {
    super();
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot);
    this.title.setTitle(title ? `Vaultfolio - ${title}` : 'Vaultfolio');
  }
}
