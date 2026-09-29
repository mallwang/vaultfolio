import type { EarningsCryptoService } from './earnings-crypto.service';
import { EarningsAvailableGuard } from './earnings-available.guard';
import { EarningsUnavailableException } from './earnings.exceptions';

describe('EarningsAvailableGuard', () => {
  it('lets requests through while the key is available', () => {
    const guard = new EarningsAvailableGuard({ available: true } as EarningsCryptoService);
    expect(guard.canActivate()).toBe(true);
  });

  it('answers 503 EARNINGS_UNAVAILABLE without a usable key', () => {
    const guard = new EarningsAvailableGuard({ available: false } as EarningsCryptoService);
    let thrown: unknown;
    try {
      guard.canActivate();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(EarningsUnavailableException);
    const exception = thrown as EarningsUnavailableException;
    expect(exception.getStatus()).toBe(503);
    expect(exception.getResponse()).toEqual({
      error: 'EARNINGS_UNAVAILABLE',
      message: 'Earnings data is temporarily unavailable.',
    });
  });
});
