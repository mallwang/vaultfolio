import { vi } from 'vitest';
import { captureChartImage } from './chart-image-capture';

const mockDataURL = 'data:image/png;base64,abc';
const mockDispose = vi.fn();
const mockSetOption = vi.fn();
const mockGetDataURL = vi.fn().mockReturnValue(mockDataURL);
const mockInit = vi.fn(() => ({
  setOption: mockSetOption,
  getDataURL: mockGetDataURL,
  dispose: mockDispose,
}));

vi.mock('echarts', () => ({ init: mockInit }));

describe('captureChartImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDataURL.mockReturnValue(mockDataURL);
  });

  it('returns the PNG data URL from the off-screen echarts instance', async () => {
    const result = await captureChartImage({ series: [] });
    expect(result).toBe(mockDataURL);
  });

  it('inits echarts with canvas renderer on a fixed 800×500 host element', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    await captureChartImage({});
    const host = appendSpy.mock.calls[0]?.[0] as HTMLElement;
    expect(host.style.width).toBe('800px');
    expect(host.style.height).toBe('500px');
    expect(mockInit).toHaveBeenCalledWith(host, undefined, { renderer: 'canvas' });
    appendSpy.mockRestore();
  });

  it('disables animation when calling setOption', async () => {
    const option = {};
    await captureChartImage(option);
    expect(mockSetOption).toHaveBeenCalledWith({ ...option, animation: false }, true);
  });

  it('disposes the instance and removes the host element when done', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    await captureChartImage({});
    const host = appendSpy.mock.calls[0][0] as HTMLElement;
    expect(mockDispose).toHaveBeenCalled();
    expect(document.body.contains(host)).toBe(false);
    appendSpy.mockRestore();
  });

  it('still disposes the instance if getDataURL throws', async () => {
    mockGetDataURL.mockImplementationOnce(() => {
      throw new Error('canvas error');
    });
    await expect(captureChartImage({})).rejects.toThrow('canvas error');
    expect(mockDispose).toHaveBeenCalled();
  });
});
