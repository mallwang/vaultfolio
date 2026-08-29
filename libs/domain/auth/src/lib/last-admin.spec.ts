import { canRemoveLastAdmin } from './last-admin.js';

describe('canRemoveLastAdmin', () => {
  it('rejects when the target is the sole active admin', () => {
    expect(canRemoveLastAdmin(1, true)).toBe(false);
  });

  it('allows when the target is an active admin but others remain', () => {
    expect(canRemoveLastAdmin(2, true)).toBe(true);
    expect(canRemoveLastAdmin(3, true)).toBe(true);
  });

  it('always allows when the target is not an active admin', () => {
    expect(canRemoveLastAdmin(1, false)).toBe(true);
    expect(canRemoveLastAdmin(0, false)).toBe(true);
  });
});
