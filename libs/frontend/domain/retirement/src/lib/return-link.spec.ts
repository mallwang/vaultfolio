import { returnLink } from './return-link';

describe('returnLink', () => {
  it.each(['statutory', 'occupational', 'private'])('returns to the %s tab', (from) => {
    expect(returnLink(from)).toEqual(['/app/retirement', from]);
  });

  it.each([null, '', 'info', '../admin'])('falls back to the overview for %j', (from) => {
    expect(returnLink(from)).toEqual(['/app/retirement']);
  });
});
