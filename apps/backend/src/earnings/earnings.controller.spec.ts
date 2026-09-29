import { EarningsController } from './earnings.controller';
import type { EarningsService } from './earnings.service';

const USER = { id: 'u1', role: 'MEMBER' as const, domainScopes: ['earnings'] };

describe('EarningsController', () => {
  const service = {
    preview: jest.fn().mockReturnValue({ files: [] }),
    commit: jest.fn().mockReturnValue({ files: [] }),
    listImports: jest.fn().mockReturnValue([]),
    deleteImport: jest.fn(),
    deleteAll: jest.fn(),
    listEmployers: jest.fn().mockReturnValue([]),
    renameEmployer: jest.fn().mockReturnValue({ id: 'e1', detectedName: 'X', displayName: 'Y' }),
    overview: jest.fn().mockReturnValue({ hasData: false }),
    records: jest.fn().mockReturnValue([]),
    tables: jest.fn().mockReturnValue({}),
    dataCheck: jest.fn().mockReturnValue([]),
  };
  const controller = new EarningsController(service as unknown as EarningsService);

  beforeEach(() => jest.clearAllMocks());

  it('passes the caller id and the raw body to preview and commit', () => {
    const body = { files: [] };
    expect(controller.preview(USER, body)).toEqual({ files: [] });
    expect(service.preview).toHaveBeenCalledWith('u1', body);
    expect(controller.commit(USER, body)).toEqual({ files: [] });
    expect(service.commit).toHaveBeenCalledWith('u1', body);
  });

  it('lists only the caller’s imports', () => {
    controller.listImports(USER);
    expect(service.listImports).toHaveBeenCalledWith('u1');
  });

  it('validates and forwards the employer filter and period', () => {
    const id = '0b6f3c7e-1d2a-4c55-9a0e-1f2e3d4c5b6a';
    controller.overview(USER, id);
    expect(service.overview).toHaveBeenCalledWith('u1', id);
    controller.overview(USER, undefined);
    expect(service.overview).toHaveBeenCalledWith('u1', undefined);
    controller.tables(USER, id);
    expect(service.tables).toHaveBeenCalledWith('u1', id);
    controller.dataCheck(USER, id);
    expect(service.dataCheck).toHaveBeenCalledWith('u1', id);
    controller.records(USER, '2026-09');
    expect(service.records).toHaveBeenCalledWith('u1', '2026-09');
    expect(() => controller.records(USER, '2026-9')).toThrow();
    expect(() => controller.overview(USER, 'nope')).toThrow();
  });

  it('forwards data management calls scoped to the caller', () => {
    controller.deleteImport(USER, 'i1');
    expect(service.deleteImport).toHaveBeenCalledWith('u1', 'i1');
    controller.deleteAll(USER);
    expect(service.deleteAll).toHaveBeenCalledWith('u1');
    controller.listEmployers(USER);
    expect(service.listEmployers).toHaveBeenCalledWith('u1');
    controller.renameEmployer(USER, 'e1', { displayName: 'Y' });
    expect(service.renameEmployer).toHaveBeenCalledWith('u1', 'e1', { displayName: 'Y' });
  });
});
