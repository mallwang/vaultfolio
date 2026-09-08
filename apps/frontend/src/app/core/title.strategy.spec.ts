import { TestBed } from '@angular/core/testing';
import { RouterStateSnapshot } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { VaultfolioTitleStrategy } from './title.strategy';

describe('VaultfolioTitleStrategy', () => {
  let title: Title;
  let strategy: VaultfolioTitleStrategy;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [VaultfolioTitleStrategy] });
    title = TestBed.inject(Title);
    strategy = TestBed.inject(VaultfolioTitleStrategy);
  });

  it('translates the route title key and prefixes it with "Vaultfolio - "', () => {
    vi.spyOn(strategy, 'buildTitle').mockReturnValue('pageTitle.dashboard');

    strategy.updateTitle({} as RouterStateSnapshot);

    expect(title.getTitle()).toBe('Vaultfolio - Dashboard');
  });

  it('uses the active language when translating the title', () => {
    TestBed.inject(I18nService).setLanguage('de');
    vi.spyOn(strategy, 'buildTitle').mockReturnValue('pageTitle.dashboard');

    strategy.updateTitle({} as RouterStateSnapshot);

    expect(title.getTitle()).toBe('Vaultfolio - Übersicht');
  });

  it('falls back to the bare product name when no route has a title', () => {
    vi.spyOn(strategy, 'buildTitle').mockReturnValue(undefined);

    strategy.updateTitle({} as RouterStateSnapshot);

    expect(title.getTitle()).toBe('Vaultfolio');
  });
});
