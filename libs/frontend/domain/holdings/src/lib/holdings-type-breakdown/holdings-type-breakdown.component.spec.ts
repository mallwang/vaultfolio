import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { HoldingsTypeBreakdownComponent } from './holdings-type-breakdown.component';

function holding(overrides: Partial<HoldingResponse>): HoldingResponse {
  return {
    id: 'id',
    assetType: 'SHARE',
    management: 'Broker',
    quantity: null,
    purchasePrice: null,
    isin: null,
    name: null,
    note: null,
    metal: null,
    coinId: null,
    unit: null,
    currentValue: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('HoldingsTypeBreakdownComponent', () => {
  let fixture: ComponentFixture<HoldingsTypeBreakdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoldingsTypeBreakdownComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HoldingsTypeBreakdownComponent);
  });

  function setInputs(assetType: HoldingResponse['assetType'], holdings: HoldingResponse[]): void {
    fixture.componentRef.setInput('assetType', assetType);
    fixture.componentRef.setInput('holdings', holdings);
    fixture.detectChanges();
  }

  function rows(): Array<{ name: string; share: string; width: string }> {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.rank__row'),
    ).map((r) => ({
      name: r.querySelector('.rank__name')?.textContent?.trim() ?? '',
      share: r.querySelector('.rank__share')?.textContent?.trim() ?? '',
      width: r.querySelector<HTMLElement>('.rank__fill')?.style.width ?? '',
    }));
  }

  it('ranks same-type holdings with distinct names by value, largest first', () => {
    setInputs('PRECIOUS_METAL', [
      holding({
        id: '1',
        assetType: 'PRECIOUS_METAL',
        metal: 'XAG',
        quantity: '1',
        purchasePrice: '10',
      }),
      holding({
        id: '2',
        assetType: 'PRECIOUS_METAL',
        metal: 'XAU',
        quantity: '1',
        purchasePrice: '25',
      }),
    ]);

    expect(rows()).toEqual([
      { name: 'Gold', share: '71.4%', width: '100%' },
      { name: 'Silver', share: '28.6%', width: '40%' },
    ]);
  });

  it('sums same-type, same-name holdings into one row', () => {
    setInputs('PRECIOUS_METAL', [
      holding({
        id: '1',
        assetType: 'PRECIOUS_METAL',
        metal: 'XAU',
        quantity: '1',
        purchasePrice: '25',
      }),
      holding({
        id: '2',
        assetType: 'PRECIOUS_METAL',
        metal: 'XAU',
        quantity: '1',
        purchasePrice: '17.5',
      }),
    ]);

    expect(rows().map((r) => r.name)).toEqual(['Gold']);
  });

  it('ignores other asset types and holdings without a computable value', () => {
    setInputs('ETF', [
      holding({ id: '1', assetType: 'ETF', name: 'Vanguard', quantity: '1', purchasePrice: '100' }),
      holding({ id: '2', assetType: 'ETF', name: 'iShares', quantity: null, purchasePrice: null }),
      holding({ id: '3', assetType: 'CRYPTO', name: 'Bitcoin', quantity: '1', purchasePrice: '5' }),
    ]);

    expect(rows().map((r) => r.name)).toEqual(['Vanguard']);
  });

  it('renders the empty-state message and no bars when the type has no holdings', () => {
    setInputs('ETF', []);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.rank__row')).toBeNull();
    expect(el.textContent).toContain(
      'Add a position with a known value to see the distribution by value.',
    );
  });
});
