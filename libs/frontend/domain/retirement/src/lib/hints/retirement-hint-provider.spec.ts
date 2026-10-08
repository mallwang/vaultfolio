import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import type { RetirementRecord } from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { RetirementService } from '../retirement.service';
import { RetirementHintProvider } from './retirement-hint-provider';

const record = (over: Partial<RetirementRecord> = {}): RetirementRecord =>
  ({
    id: 'r1',
    pillar: 'PRIVATE',
    contractType: 'RIESTER',
    providerLabel: 'Allianz',
    statementDate: new Date().toISOString().slice(0, 10),
    import: null,
    ...over,
  }) as unknown as RetirementRecord;

describe('RetirementHintProvider', () => {
  const records = vi.fn();
  let provider: RetirementHintProvider;

  beforeEach(() => {
    records.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: RetirementService, useValue: { records } },
        { provide: I18nService, useValue: { language: signal('en'), translate: (k: string) => k } },
      ],
    });
    provider = TestBed.inject(RetirementHintProvider);
  });

  it('yields nothing for a fresh, manually entered record', () => {
    records.mockReturnValue(of([record()]));
    provider.load();

    expect(provider.hints()).toEqual([]);
    expect(provider.ready()).toBe(true);
  });

  it('warns about an outdated statement and links to the record', () => {
    records.mockReturnValue(of([record({ statementDate: '2020-01-01' })]));
    provider.load();

    const [hint] = provider.hints();
    expect(hint.id).toBe('retirement.outdated.r1');
    expect(hint.severity).toBe('warning');
    expect(hint.params).toEqual({ contractName: 'Allianz' });
    expect(hint.target).toEqual({
      commands: ['/app', 'retirement', 'r1', 'edit'],
      queryParams: { from: 'private' },
    });
  });

  it('asks to double-check OCR-read records and names unlabelled ones by type', () => {
    records.mockReturnValue(
      of([
        record({
          providerLabel: null,
          import: { parserId: 'p', parserVersion: '1', ocrRead: true },
        }),
      ]),
    );
    provider.load();

    const [hint] = provider.hints();
    expect(hint.id).toBe('retirement.ocr.r1');
    expect(hint.severity).toBe('info');
    expect(hint.params).toEqual({ contractName: 'retirement.types.RIESTER' });
  });

  it('clears the hints and becomes ready when loading fails; refresh reloads', () => {
    records.mockReturnValueOnce(of([record({ statementDate: '2020-01-01' })]));
    provider.load();
    expect(provider.hints()).toHaveLength(1);

    records.mockReturnValueOnce(throwError(() => new Error('boom')));
    provider.refresh();

    expect(provider.hints()).toEqual([]);
    expect(provider.ready()).toBe(true);
  });
});
