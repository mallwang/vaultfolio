import { TestBed } from '@angular/core/testing';
import { RouterStateSnapshot } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { VaultfolioTitleStrategy } from './title.strategy';

describe('VaultfolioTitleStrategy', () => {
  let title: Title;
  let strategy: VaultfolioTitleStrategy;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [VaultfolioTitleStrategy] });
    title = TestBed.inject(Title);
    strategy = TestBed.inject(VaultfolioTitleStrategy);
  });

  it('prefixes a resolved route title with "Vaultfolio - "', () => {
    vi.spyOn(strategy, 'buildTitle').mockReturnValue('Dashboard');

    strategy.updateTitle({} as RouterStateSnapshot);

    expect(title.getTitle()).toBe('Vaultfolio - Dashboard');
  });

  it('falls back to the bare product name when no route has a title', () => {
    vi.spyOn(strategy, 'buildTitle').mockReturnValue(undefined);

    strategy.updateTitle({} as RouterStateSnapshot);

    expect(title.getTitle()).toBe('Vaultfolio');
  });
});
