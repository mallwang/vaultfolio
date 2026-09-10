import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnvironmentInjector } from '@angular/core';
import type { FeatureExportDefinition } from '@vaultfolio/export';
import { registerFeatureExports } from './feature-export.registry';

const {
  mockCreateHoldings,
  mockCreateAccountOverview,
  mockRetirementDef,
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
  return {
    mockCreateHoldings: vi.fn(() => mockHoldingsDef),
    mockCreateAccountOverview: vi.fn(() => mockAccountDef),
    mockRetirementDef,
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
  RETIREMENT_EXPORT_DEFINITION: mockRetirementDef,
}));
vi.mock('@vaultfolio/frontend-domain-insurances', () => ({
  INSURANCES_EXPORT_DEFINITION: mockInsurancesDef,
}));
vi.mock('@vaultfolio/frontend-domain-haushaltsplaner', () => ({
  HAUSHALTSPLANER_EXPORT_DEFINITION: mockHaushaltsplanerDef,
}));
vi.mock('@vaultfolio/frontend-domain-historic-wealth-development', () => ({
  HISTORIC_WEALTH_DEVELOPMENT_EXPORT_DEFINITION: mockHistoricDef,
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

  it('registers all 6 feature export definitions', async () => {
    await registerFeatureExports({ register } as never, injector);
    expect(register).toHaveBeenCalledTimes(6);
  });

  it('resolves factory-based definitions via runInInjectionContext (holdings, account-overview)', async () => {
    await registerFeatureExports({ register } as never, injector);
    expect(mockCreateHoldings).toHaveBeenCalledTimes(1);
    expect(mockCreateAccountOverview).toHaveBeenCalledTimes(1);
  });

  it('registers placeholder constants directly without a factory', async () => {
    await registerFeatureExports({ register } as never, injector);
    const registered = register.mock.calls.map((c) => c[0]);
    expect(registered).toContain(mockRetirementDef);
    expect(registered).toContain(mockInsurancesDef);
    expect(registered).toContain(mockHaushaltsplanerDef);
    expect(registered).toContain(mockHistoricDef);
  });
});
