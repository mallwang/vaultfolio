import type { InsurancesData } from '@vaultfolio/api-contract';
import { DEFAULT_SETTINGS } from '@vaultfolio/insurances';
import { buildInsuranceContract } from '@vaultfolio/insurances/testing';
import { buildInsurancesPdfSections, buildInsurancesReport } from './insurances-pdf-sections';

const t = (key: string) => key;

const data = (over: Partial<InsurancesData> = {}): InsurancesData => ({
  contracts: [
    buildInsuranceContract({ id: 'c1', name: 'Haftpflicht' }),
  ] as InsurancesData['contracts'],
  linkedSocial: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  today: '2026-09-10',
  ...over,
});

describe('insurances PDF sections', () => {
  it('shows the main tiles, a contract table with totals and the missing insurances', () => {
    const sections = buildInsurancesPdfSections(buildInsurancesReport(data(), t), t, 'de');
    expect(sections[0]).toMatchObject({ beforeChart: true });
    expect(sections.map((s) => s.kind).slice(0, 4)).toEqual(['kpis', 'table', 'table', 'table']);

    const summaryTable = sections[1];
    if (summaryTable.kind !== 'table') throw new Error('table expected');
    expect(summaryTable.rows.map((r) => r.cells['group'])).toEqual([
      'insurances.groups.LIABILITY',
      'insurances.export.pdf.totalLabel',
    ]);

    const contracts = sections[2];
    if (contracts.kind !== 'table') throw new Error('table expected');
    expect(contracts.rows.map((r) => r.cells['name'])).toEqual([
      'insurances.groups.LIABILITY',
      'Haftpflicht',
      'insurances.export.pdf.totalLabel',
    ]);
    expect(contracts.rows[0]).toMatchObject({ emphasis: 'total', cells: { yearly: '96.00' } });
    expect(contracts.rows[1]).toMatchObject({ indentKeys: ['name'] });
    expect(contracts.rows[2]).toMatchObject({
      emphasis: 'total',
      cells: { monthly: '8.00', yearly: '96.00' },
    });
    // every column has a width, so the table spans the page
    expect(contracts.columns.every((c) => c.width !== undefined)).toBe(true);

    const missing = sections[3];
    if (missing.kind !== 'table') throw new Error('table expected');
    expect(missing.rows.length).toBeGreaterThan(0);
    expect(missing.rows.map((r) => r.cells['name'])).not.toContain(
      'insurances.requirements.LIABILITY.name',
    );
  });

  it('replaces the missing table by a note when nothing is missing', () => {
    const d = data();
    d.settings.dismissedRequirements = ['HEALTH', 'HOUSEHOLD', 'DISABILITY', 'LEGAL'];
    const sections = buildInsurancesPdfSections(buildInsurancesReport(d, t), t, 'de');
    expect(sections).toContainEqual(
      expect.objectContaining({
        kind: 'text',
        text: 'insurances.export.pdf.missingNone',
      }),
    );
  });

  it('shows the gap check and the remaining insurance types', () => {
    const sections = buildInsurancesPdfSections(buildInsurancesReport(data(), t), t, 'de');
    const titles = sections.map((s) => ('title' in s ? s.title : undefined));
    expect(titles).toEqual(
      expect.arrayContaining([
        'insurances.export.pdf.missingTitle',
        'insurances.gap.coveredTitle',
        'insurances.gap.redundantTitle',
        'insurances.export.pdf.otherTitle',
      ]),
    );
    const other = sections.find(
      (s) => s.kind === 'table' && s.title === 'insurances.export.pdf.otherTitle',
    );
    if (other?.kind !== 'table') throw new Error('table expected');
    const names = other.rows.map((r) => r.cells['name']);
    expect(names).toContain('insurances.types.GLASS');
    expect(names).not.toContain('insurances.types.PRIVATE_LIABILITY');
    expect(names).not.toContain('insurances.types.STATUTORY_HEALTH');
  });

  it('builds the chart breakdown from active contracts only', () => {
    const report = buildInsurancesReport(data(), t);
    expect(report.breakdown).toEqual([
      {
        group: 'LIABILITY',
        yearly: '96.00',
        items: [{ id: 'c1', name: 'Haftpflicht', yearly: '96.00' }],
      },
    ]);
  });
});
