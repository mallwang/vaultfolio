import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TurnstileComponent } from './turnstile.component';

type TurnstileParams = {
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
};

describe('TurnstileComponent', () => {
  let fixture: ComponentFixture<TurnstileComponent>;
  let component: TurnstileComponent;

  let renderSpy: ReturnType<typeof vi.fn>;
  let resetSpy: ReturnType<typeof vi.fn>;
  let removeSpy: ReturnType<typeof vi.fn>;
  let capturedCallbacks: TurnstileParams;

  beforeEach(async () => {
    renderSpy = vi.fn((_el: unknown, params: TurnstileParams) => {
      capturedCallbacks = params;
      return 'widget-1';
    });
    resetSpy = vi.fn();
    removeSpy = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).turnstile = { render: renderSpy, reset: resetSpy, remove: removeSpy };

    await TestBed.configureTestingModule({
      imports: [TurnstileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TurnstileComponent);
    component = fixture.componentInstance;
    component.siteKey = '1x00000000000000000000AA';
    component.action = 'signup';
    fixture.detectChanges();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).turnstile;
  });

  it('renders the widget on init', () => {
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy.mock.calls[0][1]).toMatchObject({
      sitekey: '1x00000000000000000000AA',
      action: 'signup',
    });
  });

  it('emits token string on callback', () => {
    const emitted: (string | null)[] = [];
    component.tokenChange.subscribe((v) => emitted.push(v));
    capturedCallbacks.callback?.('test-token');
    expect(emitted).toEqual(['test-token']);
  });

  it('emits null on expired-callback', () => {
    const emitted: (string | null)[] = [];
    component.tokenChange.subscribe((v) => emitted.push(v));
    capturedCallbacks['expired-callback']?.();
    expect(emitted).toEqual([null]);
  });

  it('emits null on error-callback', () => {
    const emitted: (string | null)[] = [];
    component.tokenChange.subscribe((v) => emitted.push(v));
    capturedCallbacks['error-callback']?.();
    expect(emitted).toEqual([null]);
  });

  it('reset() calls turnstile.reset with the widget id', () => {
    component.reset();
    expect(resetSpy).toHaveBeenCalledWith('widget-1');
  });

  it('remove() is called on destroy', () => {
    fixture.destroy();
    expect(removeSpy).toHaveBeenCalledWith('widget-1');
  });
});
