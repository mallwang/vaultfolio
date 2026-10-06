import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import type { InsurancesData } from '@vaultfolio/api-contract';
import { DEFAULT_SETTINGS } from '@vaultfolio/insurances';
import { buildInsuranceContract } from '@vaultfolio/insurances/testing';
import { InsurancesRemindersComponent } from '../reminders/reminders.component';
import { InsurancesAreaComponent } from './insurances-area.component';
import { insurancesAvailableGuard } from './insurances-available.guard';
import { InsurancesDangerZoneComponent } from './insurances-danger-zone.component';

const data = (over: Partial<InsurancesData> = {}): InsurancesData => ({
  contracts: [],
  linkedSocial: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  today: '2026-09-10',
  ...over,
});

// Protected members are reached through `any` on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, sonarjs/redundant-type-aliases
type Internals = any;

describe('insurances area pieces', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CURRENT_USER_SOURCE, useValue: { current: () => ({ id: 'user-1' }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('insurancesAvailableGuard', () => {
    const run = (status: number | null) => {
      const result = TestBed.runInInjectionContext(() => insurancesAvailableGuard());
      const req = http.expectOne('/api/insurances');
      if (status === null) req.flush(data());
      else req.flush({}, { status, statusText: 'x' });
      return result;
    };

    it('allows when the probe succeeds', async () => {
      expect(await run(null)).toBe(true);
    });

    it('redirects to the area on 503', async () => {
      const result = await run(503);
      expect(result).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/app/insurances');
    });

    it('lets the screen open on other errors', async () => {
      expect(await run(500)).toBe(true);
    });

    it('sanity: HttpErrorResponse is what the guard inspects', () => {
      expect(new HttpErrorResponse({ status: 503 }).status).toBe(503);
    });
  });

  describe('InsurancesDangerZoneComponent', () => {
    it('opens, closes and resets the failure state', () => {
      const c = TestBed.createComponent(InsurancesDangerZoneComponent)
        .componentInstance as Internals;
      c.open.set(true);
      c.failed.set(true);
      c.close();
      expect(c.open()).toBe(false);
      expect(c.failed()).toBe(false);
    });

    it('closes and refreshes after a successful delete', () => {
      const c = TestBed.createComponent(InsurancesDangerZoneComponent)
        .componentInstance as Internals;
      c.open.set(true);
      c.confirm();
      http.expectOne({ method: 'DELETE', url: '/api/insurances' }).flush(null);
      expect(c.open()).toBe(false);
      http.expectOne({ method: 'GET', url: '/api/insurances' }).flush(data());
    });

    it('keeps the dialog open and flags a failed delete', () => {
      const c = TestBed.createComponent(InsurancesDangerZoneComponent)
        .componentInstance as Internals;
      c.open.set(true);
      c.confirm();
      http
        .expectOne({ method: 'DELETE', url: '/api/insurances' })
        .flush({}, { status: 500, statusText: 'x' });
      expect(c.failed()).toBe(true);
      expect(c.open()).toBe(true);
    });
  });

  describe('InsurancesAreaComponent', () => {
    it('saves the social switch and applies the server answer', () => {
      const c = TestBed.createComponent(InsurancesAreaComponent).componentInstance as Internals;
      http.expectOne({ method: 'GET', url: '/api/insurances' }).flush(data());
      c.setIncludeSocial(false);
      expect(c.store.settings().includeSocial).toBe(false);
      const saved = { ...DEFAULT_SETTINGS, includeSocial: false };
      http.expectOne({ method: 'PUT', url: '/api/insurances/settings' }).flush(saved);
      expect(c.store.settings().includeSocial).toBe(false);
    });

    it('refreshes when saving the social switch fails', () => {
      const c = TestBed.createComponent(InsurancesAreaComponent).componentInstance as Internals;
      http.expectOne({ method: 'GET', url: '/api/insurances' }).flush(data());
      c.setIncludeSocial(false);
      http
        .expectOne({ method: 'PUT', url: '/api/insurances/settings' })
        .flush({}, { status: 500, statusText: 'x' });
      http.expectOne({ method: 'GET', url: '/api/insurances' }).flush(data());
      expect(c.store.settings().includeSocial).toBe(true);
    });
  });

  describe('InsurancesAreaComponent reminder count', () => {
    const count = (enabled: boolean, reminderEnabled: boolean) => {
      const c = TestBed.createComponent(InsurancesAreaComponent).componentInstance as Internals;
      http.expectOne({ method: 'GET', url: '/api/insurances' }).flush(
        data({
          contracts: [buildInsuranceContract({ id: 'c1', reminderEnabled })] as never,
          settings: { ...structuredClone(DEFAULT_SETTINGS), reminders: { enabled, leadDays: 30 } },
        }),
      );
      return c;
    };

    it('counts contracts that will remind', () => {
      const c = count(true, true);
      expect(c.activeReminders()).toBe(1);
      expect(c.remindersLabel()).toBe('1 reminder on');
    });

    it('is zero when the global switch is off', () => {
      expect(count(false, true).activeReminders()).toBe(0);
    });

    it('is zero when the contract switch is off', () => {
      expect(count(true, false).activeReminders()).toBe(0);
    });
  });

  describe('InsurancesRemindersComponent', () => {
    const create = () => {
      const c = TestBed.createComponent(InsurancesRemindersComponent)
        .componentInstance as Internals;
      http
        .expectOne({ method: 'GET', url: '/api/insurances' })
        .flush(data({ contracts: [buildInsuranceContract({ id: 'c1' })] as never }));
      return c;
    };

    it('offers the lead-time options', () => {
      const c = create();
      expect(c.leadOptions().map((o: { value: number }) => o.value)).toEqual([
        7, 14, 30, 60, 90, 120,
      ]);
    });

    it('shows no planned mail while reminders are off', () => {
      const c = create();
      const contract = buildInsuranceContract({ id: 'c1', reminderEnabled: true });
      expect(c.sendScheduled(contract)).toBe(false);
      expect(c.sendLabel(contract)).toBe('No mail planned');
    });

    it('shows the planned send date once reminders are on', () => {
      const c = create();
      c.store.setSettings({
        ...DEFAULT_SETTINGS,
        reminders: { enabled: true, leadDays: 30 },
      });
      const on = buildInsuranceContract({ id: 'c1', reminderEnabled: true });
      const off = buildInsuranceContract({ id: 'c1', reminderEnabled: false });
      expect(c.sendScheduled(on)).toBe(true);
      expect(c.sendLabel(on)).toMatch(/^Mail on /);
      expect(c.sendScheduled(off)).toBe(false);
    });

    it('lists contracts that can remind', () => {
      expect(
        create()
          .contracts()
          .map((x: { id: string }) => x.id),
      ).toEqual(['c1']);
    });

    it('saves the enabled switch', () => {
      const c = create();
      c.setEnabled(true);
      const req = http.expectOne({ method: 'PUT', url: '/api/insurances/settings' });
      expect(req.request.body.reminders.enabled).toBe(true);
      req.flush({ ...DEFAULT_SETTINGS, reminders: { enabled: true, leadDays: 30 } });
      expect(c.failed()).toBe(false);
    });

    it('saves the lead days and flags a failure with a refresh', () => {
      const c = create();
      c.setLeadDays(60);
      http
        .expectOne({ method: 'PUT', url: '/api/insurances/settings' })
        .flush({}, { status: 500, statusText: 'x' });
      expect(c.failed()).toBe(true);
      http.expectOne({ method: 'GET', url: '/api/insurances' }).flush(data());
    });

    it('updates a contract reminder without server-only fields', () => {
      const c = create();
      c.setContract(buildInsuranceContract({ id: 'c1' }), false);
      const req = http.expectOne({ method: 'PUT', url: '/api/insurances/contracts/c1' });
      expect(req.request.body.reminderEnabled).toBe(false);
      expect(req.request.body.id).toBeUndefined();
      expect(req.request.body.createdAt).toBeUndefined();
      req.flush(buildInsuranceContract({ id: 'c1' }));
      http.expectOne({ method: 'GET', url: '/api/insurances' }).flush(data());
    });

    it('flags a failed contract update', () => {
      const c = create();
      c.setContract(buildInsuranceContract({ id: 'c1' }), true);
      http
        .expectOne({ method: 'PUT', url: '/api/insurances/contracts/c1' })
        .flush({}, { status: 500, statusText: 'x' });
      expect(c.failed()).toBe(true);
      http.expectOne({ method: 'GET', url: '/api/insurances' }).flush(data());
    });
  });
});
