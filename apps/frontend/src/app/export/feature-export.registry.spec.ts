import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnvironmentInjector } from '@angular/core';
import type { FeatureExportDefinition } from '@vaultfolio/export';
import { registerFeatureExports } from './feature-export.registry';

const {
  mockCreateEarnings,
  mockCreateHoldings,
  mockCreateAccountOverview,
  mockCreateRetirement,
  mockCreateWealth,
  mockInsurancesDef,
  mockHaushaltsplanerDef,
  mockHistoricDef,
} = vi.hoisted(() => {
  const mockHoldingsDef = { featureId: 'holdings' } as unknown as FeatureExportDefinition;
  const mockAccountDef = { featureId: 'account-overview' } as unknown as FeatureExportDefinition;
  const mockRetirementDef = { featureId: 'retirement' } as unknown as FeatureExportDefinition;
  const mockInsurancesDef = { featureId: 'insurances' } as unknown as FeatureExportDefinition;
  const mockHaushaltsplanerDef = {
    featureId: 'haushaltsplaner',
  } as unknown as FeatureExportDefinition;
  const mockHistoricDef = {
    featureId: 'historic-wealth-development',
  } as unknown as FeatureExportDefinition;
  const mockEarningsDef = { featureId: 'earnings' } as unknown as FeatureExportDefinition;
  return {
    mockCreateEarnings: vi.fn(() => mockEarningsDef),
    mockCreateHoldings: vi.fn(() => mockHoldingsDef),
    mockCreateAccountOverview: vi.fn(() => mockAccountDef),
    mockCreateRetirement: vi.fn(() => mockRetirementDef),
    mockCreateWealth: vi.fn(() => mockHistoricDef),
    mockInsurancesDef,
    mockHaushaltsplanerDef,
    mockHistoricDef,
    mockHoldingsDef,
    mockAccountDef,
  };
});

vi.mock('@vaultfolio/frontend-domain-holdings', () => ({
  createHoldingsExportDefinition: mockCreateHoldings,
}));
vi.mock('@vaultfolio/frontend-domain-account-overview', () => ({
  createAccountOverviewExportDefinition: mockCreateAccountOverview,
}));
vi.mock('@vaultfolio/frontend-domain-retirement', () => ({
  createRetirementExportDefinition: mockCreateRetirement,
}));
vi.mock('@vaultfolio/frontend-domain-insurances', () => ({
  INSURANCES_EXPORT_DEFINITION: mockInsurancesDef,
}));
vi.mock('@vaultfolio/frontend-domain-haushaltsplaner', () => ({
  HAUSHALTSPLANER_EXPORT_DEFINITION: mockHaushaltsplanerDef,
}));
vi.mock('@vaultfolio/frontend-domain-earnings', () => ({
  createEarningsExportDefinition: mockCreateEarnings,
}));
vi.mock('@vaultfolio/frontend-domain-historic-wealth-development', () => ({
  createWealthExportDefinition: mockCreateWealth,
}));

describe('registerFeatureExports', () => {
  let register: ReturnType<typeof vi.fn>;
  let injector: EnvironmentInjector;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({});
    injector = TestBed.inject(EnvironmentInjector);
    register = vi.fn();
  });

  it('registers all 7 feature export definitions', async () => {
    await registerFeatureExports({ register } as never, injector);
    expect(register).toHaveBeenCalledTimes(7);
  });

  it('resolves factory-based definitions via runInInjectionContext (holdings, account-overview, earnings, retirement, wealth)', async () => {
    await registerFeatureExports({ register } as never, injector);
    expect(mockCreateHoldings).toHaveBeenCalledTimes(1);
    expect(mockCreateAccountOverview).toHaveBeenCalledTimes(1);
    expect(mockCreateEarnings).toHaveBeenCalledTimes(1);
    expect(mockCreateRetirement).toHaveBeenCalledTimes(1);
    expect(mockCreateWealth).toHaveBeenCalledTimes(1);
    expect(register.mock.calls.map((c) => c[0])).toContain(mockHistoricDef);
  });

  it('registers placeholder constants directly without a factory', async () => {
    await registerFeatureExports({ register } as never, injector);
    const registered = register.mock.calls.map((c) => c[0]);
    expect(registered).toContain(mockInsurancesDef);
    expect(registered).toContain(mockHaushaltsplanerDef);
  });
});
