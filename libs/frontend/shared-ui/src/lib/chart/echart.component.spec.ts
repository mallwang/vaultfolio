import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { EChartsOption } from 'echarts';
import { EchartComponent } from './echart.component';
import { ThemeService } from '../theme/theme.service';

const mockInstance = {
  setOption: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('echarts', () => ({
  init: vi.fn(() => mockInstance),
}));

/** Flushes the microtask/macrotask queue past `ngAfterViewInit`'s `await import('echarts')`. */
async function flushEchartsInit(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
  readonly unobserve = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

describe('EchartComponent', () => {
  let fixture: ComponentFixture<EchartComponent>;
  let themeService: ThemeService;

  beforeEach(async () => {
    vi.clearAllMocks();
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    await TestBed.configureTestingModule({
      imports: [EchartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EchartComponent);
    themeService = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies the option on init', async () => {
    const option: EChartsOption = { series: [{ type: 'pie', data: [{ name: 'a', value: 1 }] }] };
    fixture.componentInstance.option = option;

    fixture.detectChanges();
    await flushEchartsInit();

    expect(mockInstance.setOption).toHaveBeenCalledWith(option, true);
  });

  it('shows the loading overlay instead of applying option when loading=true', async () => {
    fixture.componentInstance.option = { series: [] };
    fixture.componentInstance.loading = true;

    fixture.detectChanges();
    await flushEchartsInit();

    expect(mockInstance.showLoading).toHaveBeenCalled();
    expect(mockInstance.setOption).not.toHaveBeenCalledWith({ series: [] }, true);
  });

  it('hides the loading overlay and re-applies option when loading transitions back to false', async () => {
    const option: EChartsOption = { series: [{ type: 'pie', data: [] }] };
    fixture.componentInstance.option = option;
    fixture.componentInstance.loading = true;
    fixture.detectChanges();
    await flushEchartsInit();

    mockInstance.setOption.mockClear();
    fixture.componentInstance.loading = false;
    fixture.componentInstance.ngOnChanges({
      loading: {
        previousValue: true,
        currentValue: false,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(mockInstance.hideLoading).toHaveBeenCalled();
    expect(mockInstance.setOption).toHaveBeenCalledWith(option, true);
  });

  it('re-applies palette colors via setOption when the theme changes', async () => {
    fixture.componentInstance.option = { series: [] };
    fixture.detectChanges();
    await flushEchartsInit();

    mockInstance.setOption.mockClear();
    themeService.toggle();
    TestBed.flushEffects();

    expect(mockInstance.setOption).toHaveBeenCalledWith(
      expect.objectContaining({ color: expect.any(Array) }),
    );
  });

  it('calls resize() on the ECharts instance when the host resizes', async () => {
    fixture.componentInstance.option = { series: [] };
    fixture.detectChanges();
    await flushEchartsInit();

    expect(FakeResizeObserver.instances).toHaveLength(1);
    FakeResizeObserver.instances[0].trigger();

    expect(mockInstance.resize).toHaveBeenCalled();
  });

  it('disposes the ECharts instance and disconnects the resize observer on destroy', async () => {
    fixture.componentInstance.option = { series: [] };
    fixture.detectChanges();
    await flushEchartsInit();

    fixture.destroy();

    expect(mockInstance.dispose).toHaveBeenCalled();
    expect(FakeResizeObserver.instances[0].disconnect).toHaveBeenCalled();
  });
});
