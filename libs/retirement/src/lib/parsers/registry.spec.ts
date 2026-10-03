import { textDocument } from '@vaultfolio/document-text';
import {
  PERSONAL_LINES,
  syntheticCapitalAccountStatement,
  syntheticDrvRenteninformation,
  syntheticPrivateStatement,
  syntheticUnrelatedDocument,
} from '../testing/statements.fixtures';
import { PARSERS, parseStatement } from './registry';
import type { StatementParser } from './types';

describe('parseStatement', () => {
  it('routes each layout to its parser', () => {
    const ids = [
      syntheticDrvRenteninformation(),
      syntheticPrivateStatement(),
      syntheticCapitalAccountStatement(),
    ].map((doc) => {
      const outcome = parseStatement(doc);
      return outcome.ok ? outcome.parser.id : outcome.error;
    });
    expect(ids).toEqual([
      'drv-renteninformation',
      'private-statement',
      'capital-account-statement',
    ]);
  });

  it('registers the three launch parsers with distinct ids and versions', () => {
    expect(PARSERS.map((p) => p.id)).toEqual([
      'drv-renteninformation',
      'private-statement',
      'capital-account-statement',
    ]);
    expect(PARSERS.every((p) => /^\d+\.\d+\.\d+$/.test(p.version))).toBe(true);
  });

  it('lets the first matching parser win', () => {
    const calls: string[] = [];
    const parser = (id: string): StatementParser => ({
      id,
      version: '1.0.0',
      detects: () => true,
      parse: () => {
        calls.push(id);
        return { ok: false, error: 'INCOMPLETE' };
      },
    });
    parseStatement(textDocument([['x']]), [parser('first'), parser('second')]);
    expect(calls).toEqual(['first']);
  });

  it('answers UNRECOGNISED for an unrelated document and an empty one', () => {
    expect(parseStatement(syntheticUnrelatedDocument())).toEqual({
      ok: false,
      error: 'UNRECOGNISED',
    });
    expect(parseStatement(textDocument([[]]))).toEqual({ ok: false, error: 'UNRECOGNISED' });
  });

  it('is deterministic for the same input', () => {
    const doc = syntheticDrvRenteninformation();
    expect(parseStatement(doc)).toEqual(parseStatement(doc));
  });

  it('never lets name, address, tax id or bank data reach the output', () => {
    const docs = [
      syntheticDrvRenteninformation(),
      syntheticPrivateStatement(),
      syntheticCapitalAccountStatement(),
    ];
    for (const doc of docs) {
      const json = JSON.stringify(parseStatement(doc));
      for (const line of PERSONAL_LINES) expect(json).not.toContain(line);
      expect(json).not.toMatch(/Musterfrau|Musterweg|DE02|12 345 678 901/);
    }
  });
});
