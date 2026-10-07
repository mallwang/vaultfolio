import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import type { DomainKeyStatus, EncryptionDomainId, RotationRun } from '@vaultfolio/api-contract';
import { EncryptionComponent } from './encryption.component';

const run = (over: Partial<RotationRun> = {}): RotationRun => ({
  id: 'run-1',
  domain: 'wealth',
  kind: 'MASTER_KEY',
  status: 'SUCCEEDED',
  startedAt: '2026-10-01T10:00:00.000Z',
  finishedAt: '2026-10-01T10:00:01.000Z',
  triggeredByEmail: 'admin@example.com',
  fromVersion: null,
  toVersion: null,
  recordsTotal: 1,
  recordsDone: 1,
  errorCode: null,
  ...over,
});

const status = (
  domain: EncryptionDomainId,
  over: Partial<DomainKeyStatus> = {},
): DomainKeyStatus => ({
  domain,
  state: 'READY',
  currentVersion: 2,
  retiredVersions: [],
  rotationPending: false,
  previousKeyRemovable: false,
  rowsPerVersion: { '2': 3 },
  lastRun: null,
  runningRun: null,
  ...over,
});

const DOMAINS: EncryptionDomainId[] = [
  'earnings',
  'retirement',
  'wealth',
  'insurances',
  'account-overview',
];

describe('EncryptionComponent', () => {
  let fixture: ComponentFixture<EncryptionComponent>;
  let http: HttpTestingController;

  const el = (testId: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`);

  async function load(
    overrides: Partial<Record<EncryptionDomainId, Partial<DomainKeyStatus>>> = {},
    runs: RotationRun[] = [],
  ) {
    fixture = TestBed.createComponent(EncryptionComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/admin/encryption/status')
      .flush({ domains: DOMAINS.map((d) => status(d, overrides[d])) });
    http.expectOne((r) => r.url === '/api/admin/encryption/history').flush({ runs });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EncryptionComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
  });

  it('renders a card per domain with its state and data key version', async () => {
    await load({ wealth: { state: 'KEY_MISMATCH', currentVersion: null } });
    for (const d of DOMAINS) expect(el(`encryption-domain-${d}`)).not.toBeNull();
    expect(el('encryption-wealth-state')?.textContent).toContain('Wrong key');
    expect(el('encryption-earnings-state')?.textContent).toContain('Ready');
    expect(el('encryption-domain-earnings')?.textContent).toContain('v2');
    expect(el('encryption-domain-wealth')?.textContent).toContain('does not open the stored data');
  });

  it('disables the operations of a locked domain but keeps the screen usable', async () => {
    await load({ wealth: { state: 'KEY_MISSING', currentVersion: null } });
    expect((el('encryption-wealth-rotate-master-key') as HTMLButtonElement).disabled).toBe(true);
    expect((el('encryption-wealth-reencrypt') as HTMLButtonElement).disabled).toBe(true);
    expect((el('encryption-earnings-rotate-master-key') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the rotation hints', async () => {
    await load({
      earnings: { rotationPending: true },
      wealth: { previousKeyRemovable: true },
    });
    expect(el('encryption-domain-earnings')?.textContent).toContain('previous master key');
    expect(el('encryption-domain-wealth')?.textContent).toContain('can be removed');
  });

  it('rotates the master key and reloads', async () => {
    await load();
    (el('encryption-wealth-rotate-master-key') as HTMLButtonElement).click();
    const req = http.expectOne('/api/admin/encryption/domains/wealth/master-key-rotation');
    expect(req.request.method).toBe('POST');
    req.flush(run());
    http
      .expectOne('/api/admin/encryption/status')
      .flush({ domains: DOMAINS.map((d) => status(d)) });
    http.expectOne((r) => r.url === '/api/admin/encryption/history').flush({ runs: [run()] });
    fixture.detectChanges();
    expect(el('encryption-history-row-run-1')).not.toBeNull();
  });

  it('only starts a re-encryption after the domain id is typed', async () => {
    await load();
    (el('encryption-wealth-reencrypt') as HTMLButtonElement).click();
    fixture.detectChanges();
    const submit = el('encryption-reencrypt-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const input = el('encryption-reencrypt-confirm-input') as HTMLInputElement;
    input.value = 'wealth';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(submit.disabled).toBe(false);
    submit.click();

    const req = http.expectOne('/api/admin/encryption/domains/wealth/reencryption');
    expect(req.request.body).toEqual({ confirm: 'wealth' });
    req.flush(run({ kind: 'DATA_KEY', status: 'RUNNING' }));
    http
      .expectOne('/api/admin/encryption/status')
      .flush({ domains: DOMAINS.map((d) => status(d)) });
    http.expectOne((r) => r.url === '/api/admin/encryption/history').flush({ runs: [] });
  });

  it('shows progress for a running operation and polls until it ends', async () => {
    vi.useFakeTimers();
    try {
      await load({
        wealth: {
          state: 'REENCRYPTING',
          runningRun: run({
            kind: 'DATA_KEY',
            status: 'RUNNING',
            recordsDone: 5,
            recordsTotal: 10,
          }),
        },
      });
      expect(el('encryption-domain-wealth')?.textContent).toContain('5 of 10 records');
      expect(el('encryption-wealth-progress')).not.toBeNull();

      vi.advanceTimersByTime(2000);
      http
        .expectOne('/api/admin/encryption/status')
        .flush({ domains: DOMAINS.map((d) => status(d)) });
      http.expectOne((r) => r.url === '/api/admin/encryption/history').flush({ runs: [] });
      vi.advanceTimersByTime(10_000);
      http.expectNone('/api/admin/encryption/status');
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers to destroy a retired key and asks for confirmation first', async () => {
    await load({ wealth: { retiredVersions: [2], currentVersion: 3 } });
    const button = el('encryption-wealth-destroy-2') as HTMLButtonElement;
    expect(button.textContent).toContain('v2');
    button.click();
    fixture.detectChanges();
    http.expectNone('/api/admin/encryption/domains/wealth/data-keys/2/destroy');
  });

  it('shows a translated error for a refused operation', async () => {
    await load();
    (el('encryption-wealth-rotate-master-key') as HTMLButtonElement).click();
    http
      .expectOne('/api/admin/encryption/domains/wealth/master-key-rotation')
      .flush({ error: 'ENCRYPTION_OPERATION_RUNNING' }, { status: 409, statusText: 'Conflict' });
    http
      .expectOne('/api/admin/encryption/status')
      .flush({ domains: DOMAINS.map((d) => status(d)) });
    http.expectOne((r) => r.url === '/api/admin/encryption/history').flush({ runs: [] });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Another operation is already running for this domain.',
    );
  });

  it('shows a load error when the status cannot be read', () => {
    fixture = TestBed.createComponent(EncryptionComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/admin/encryption/status')
      .error(new ProgressEvent('error'), { status: 500 });
    http
      .expectOne((r) => r.url === '/api/admin/encryption/history')
      .error(new ProgressEvent('error'), { status: 500 });
    fixture.detectChanges();
    expect(el('encryption-load-error')?.textContent).toContain('Unable to load');
  });

  it('lists the history with the system label for startup runs', async () => {
    await load({}, [run({ id: 'sys', kind: 'LEGACY_MIGRATION', triggeredByEmail: null })]);
    expect(el('encryption-history-row-sys')?.textContent).toContain('System (startup)');
    expect(el('encryption-history-row-sys')?.textContent).toContain('Upgrade migration');
  });
});
