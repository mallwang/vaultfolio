import { RetirementAvailableGuard } from './retirement-available.guard';
import type { RetirementCryptoService } from './retirement-crypto.service';
import { RetirementUnavailableException } from './retirement.exceptions';

describe('RetirementAvailableGuard', () => {
  it('lets requests through while the key is available', () => {
    const guard = new RetirementAvailableGuard({ available: true } as RetirementCryptoService);
    expect(guard.canActivate()).toBe(true);
  });

  it('answers 503 RETIREMENT_UNAVAILABLE without a usable key', () => {
    const guard = new RetirementAvailableGuard({ available: false } as RetirementCryptoService);
    let thrown: unknown;
    try {
      guard.canActivate();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(RetirementUnavailableException);
    const exception = thrown as RetirementUnavailableException;
    expect(exception.getStatus()).toBe(503);
    expect(exception.getResponse()).toEqual({
      error: 'RETIREMENT_UNAVAILABLE',
      message: 'Retirement data is temporarily unavailable.',
    });
  });
});
