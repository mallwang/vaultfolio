import { isDraftEmpty, parseDraft, serializeDraft } from './feedback-draft';

describe('feedback draft', () => {
  const draft = { category: 'problem', subject: 'Hi', message: 'Body' } as const;

  it('round-trips', () => {
    expect(parseDraft(serializeDraft(draft))).toEqual(draft);
  });

  it('treats garbage, wrong version and bad category as absent', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('{nope')).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 2, ...draft }))).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 1, ...draft, category: 'x' }))).toBeNull();
    expect(
      parseDraft(JSON.stringify({ v: 1, category: 'other', subject: 1, message: '' })),
    ).toBeNull();
  });

  it('detects empty drafts (whitespace only counts as empty)', () => {
    expect(isDraftEmpty({ subject: ' ', message: '' })).toBe(true);
    expect(isDraftEmpty({ subject: 'a', message: '' })).toBe(false);
    expect(isDraftEmpty({ subject: '', message: 'b' })).toBe(false);
  });
});
