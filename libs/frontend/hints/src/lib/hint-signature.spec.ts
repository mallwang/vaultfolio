import { hintSignature } from './hint-signature';
import type { Hint } from './hint';

const base: Hint = {
  id: 'test.hint.1',
  severity: 'warning',
  titleKey: 'hints.test.title',
  descriptionKey: 'hints.test.desc',
  target: { commands: ['/test'] },
  linkLabelKey: 'hints.test.link',
};

describe('hintSignature', () => {
  it('is stable across evaluations', () => {
    expect(hintSignature(base)).toBe(hintSignature(base));
  });

  it('is language-independent (same keys, no params change → same signature)', () => {
    const a = hintSignature({ ...base });
    const b = hintSignature({ ...base });
    expect(a).toBe(b);
  });

  it('changes when params change', () => {
    const withParams = hintSignature({ ...base, params: { name: 'Alice' } });
    const withOtherParams = hintSignature({ ...base, params: { name: 'Bob' } });
    expect(withParams).not.toBe(withOtherParams);
  });

  it('ignores param key order (canonical)', () => {
    const a = hintSignature({ ...base, params: { a: '1', b: '2' } });
    const b = hintSignature({ ...base, params: { b: '2', a: '1' } });
    expect(a).toBe(b);
  });

  it('changes when severity changes', () => {
    const w = hintSignature({ ...base, severity: 'warning' });
    const i = hintSignature({ ...base, severity: 'info' });
    expect(w).not.toBe(i);
  });

  it('returns a hex string', () => {
    expect(hintSignature(base)).toMatch(/^[0-9a-f]+$/);
  });
});
