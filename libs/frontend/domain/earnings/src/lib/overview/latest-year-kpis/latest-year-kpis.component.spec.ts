import { TestBed } from '@angular/core/testing';
import type { LatestYear, LatestYearFigures } from '@vaultfolio/api-contract';
import { I18nService, en } from '@vaultfolio/frontend-shared-ui';
import { LatestYearKpisComponent, kpiTiles } from './latest-year-kpis.component';

function figures(partial: Partial<LatestYearFigures> = {}): LatestYearFigures {
  return {
    gross: '45000.00',
    net: '27720.00',
    taxes: '8280.00',
    social: '9000.00',
    bonus: '0.00',
    netRatio: '0.6160',
    ...partial,
  };
}

const translate = (key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en) as string;

describe('kpiTiles', () => {
  it('compares with the same months of the previous year: deltas, direction and good/bad tone', () => {
    const tiles = kpiTiles(
      figures(),
      figures({
        gross: '43000.00',
        net: '26660.00',
        taxes: '7900.00',
        social: '9100.00',
        bonus: '500.00',
        netRatio: '0.6200',
      }),
      'en',
      translate,
    );
    const byKey = Object.fromEntries(tiles.map((t) => [t.key, t]));

    expect(byKey['gross']).toMatchObject({
      value: '€45,000',
      delta: '+€2,000',
      previous: '€43,000',
      direction: 'up',
      tone: 'good',
    });
    expect(byKey['taxes']).toMatchObject({ delta: '+€380', direction: 'up', tone: 'bad' });
    expect(byKey['social']).toMatchObject({ delta: '-€100', direction: 'down', tone: 'good' });
    expect(byKey['bonus']).toMatchObject({ delta: '-€500', direction: 'down', tone: 'bad' });
    expect(byKey['netRatio']).toMatchObject({
      value: '61.6%',
      delta: '-0.4 pp',
      direction: 'down',
      tone: 'bad',
    });
  });

  it('shows net, taxes, social and bonus as a share of gross', () => {
    const tiles = kpiTiles(figures({ bonus: '4500.00' }), null, 'en', translate);
    const share = Object.fromEntries(tiles.map((t) => [t.key, t.share]));

    expect(share).toEqual({
      gross: null,
      net: '61.6% of gross',
      taxes: '18.4% of gross',
      social: '20.0% of gross',
      bonus: '10.0% of gross',
      netRatio: null,
    });
    expect(kpiTiles(figures(), null, 'de', translate)[2].share).toBe('18,4\u00a0% of gross');
  });

  it('shows no delta without a previous year', () => {
    expect(
      kpiTiles(figures(), null, 'en', translate).every(
        (t) => t.delta === null && t.tone === 'neutral',
      ),
    ).toBe(true);
  });

  it('formats German amounts', () => {
    expect(kpiTiles(figures(), null, 'de', translate)[0].value).toBe('45.000\u00a0€');
  });
});

describe('LatestYearKpisComponent', () => {
  it('renders "2026 (9 months)" compared with Jan–Sep of 2025', () => {
    const latest: LatestYear = {
      year: 2026,
      months: 9,
      comparedMonths: [1, 9],
      current: figures(),
      previous: figures(),
    };
    TestBed.inject(I18nService).setLanguage('en');
    const fixture = TestBed.createComponent(LatestYearKpisComponent);
    fixture.componentRef.setInput('latest', latest);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('2026 (9 months)');
    expect(text).toContain('Compared with the same months of 2025 (Jan–Sep)');
    expect(fixture.nativeElement.querySelectorAll('.tile')).toHaveLength(6);
  });
});
