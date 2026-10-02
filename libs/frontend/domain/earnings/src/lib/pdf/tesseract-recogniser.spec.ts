import { type PdfJsModule, setPdfJsLoader } from './pdf-text-extractor';
import {
  MAX_PAGE_PIXELS,
  RENDER_SCALE,
  scaleFor,
  setTesseractLoader,
  createTesseractRecogniser,
} from './tesseract-recogniser';
import type { RecognitionProgress } from './text-recogniser';

const word = (text: string, x0: number, y0: number, x1: number, y1: number) => ({
  text,
  confidence: 90,
  bbox: { x0, y0, x1, y1 },
});

interface Fixture {
  pages: number;
  width?: number;
  height?: number;
  words?: ReturnType<typeof word>[];
  createWorkerError?: boolean;
  recogniseNever?: boolean;
}

interface Calls {
  createWorker: unknown[][];
  terminated: number;
  rendered: number;
  destroyed: number;
}

function fakePdfJs(fixture: Fixture, calls: Calls): PdfJsModule {
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({
      width: (fixture.width ?? 600) * scale,
      height: (fixture.height ?? 800) * scale,
    }),
    render: () => {
      calls.rendered++;
      return { promise: Promise.resolve() };
    },
  };
  const doc = { numPages: fixture.pages, getPage: async () => page };
  const task = {
    promise: Promise.resolve(doc),
    destroy: async () => {
      calls.destroyed++;
    },
  };
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: () => task,
  } as unknown as PdfJsModule;
}

function fakeWorker(fixture: Fixture, calls: Calls, logger: (m: unknown) => void) {
  const blocks = [{ paragraphs: [{ lines: [{ words: fixture.words ?? [] }] }] }];
  return {
    recognize: () => {
      logger({ status: 'recognizing text', progress: 0.5 });
      return fixture.recogniseNever
        ? new Promise<never>(() => undefined)
        : Promise.resolve({ data: { blocks } });
    },
    terminate: async () => {
      calls.terminated++;
    },
  };
}

function install(fixture: Fixture) {
  const calls: Calls = { createWorker: [], terminated: 0, rendered: 0, destroyed: 0 };
  setPdfJsLoader(async () => fakePdfJs(fixture, calls));
  setTesseractLoader(async () => ({
    createWorker: async (...args: unknown[]) => {
      calls.createWorker.push(args);
      if (fixture.createWorkerError) throw new Error('boom');
      return fakeWorker(fixture, calls, (args[2] as { logger: (m: unknown) => void }).logger);
    },
  }));
  return calls;
}

describe('TesseractRecogniser', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as CanvasRenderingContext2D,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  const run = (
    signal = new AbortController().signal,
    onProgress: (p: RecognitionProgress) => void = vi.fn(),
  ) =>
    createTesseractRecogniser().recognise(new File(['%PDF'], 'scan.pdf'), { signal, onProgress });

  it('recognises pages into RECOGNISED text and releases the worker', async () => {
    const calls = install({ pages: 2, words: [word('Brutto', 30, 60, 90, 90)] });
    const result = await run();
    expect(result).toMatchObject({ text: { origin: 'RECOGNISED' } });
    if (!('text' in result)) throw new Error('expected text');
    expect(result.text.pages).toHaveLength(2);
    expect(result.text.pages[0].lines[0].text).toBe('Brutto');
    expect(calls.rendered).toBe(2);
    expect(calls.terminated).toBe(1);
    expect(calls.destroyed).toBe(1);
  });

  it('loads engine, worker and German data only from same-origin assets, without cache', async () => {
    const calls = install({ pages: 1, words: [word('Brutto', 30, 60, 90, 90)] });
    await run();
    const [langs, , options] = calls.createWorker[0] as [string, number, Record<string, unknown>];
    expect(langs).toBe('deu');
    expect(options).toMatchObject({ cacheMethod: 'none', gzip: true });
    for (const key of ['workerPath', 'corePath', 'langPath']) {
      const url = new URL(options[key] as string);
      expect(url.origin).toBe(new URL(document.baseURI).origin);
      expect(url.pathname).toContain('/assets/tesseract');
    }
  });

  it('refuses documents above the page limit before rendering or starting the engine', async () => {
    const calls = install({ pages: 6 });
    expect(await run()).toEqual({ error: 'TOO_MANY_PAGES' });
    expect(calls.rendered).toBe(0);
    expect(calls.createWorker).toHaveLength(0);
    expect(calls.destroyed).toBe(1);
  });

  it('maps an engine that cannot be loaded to ENGINE_UNAVAILABLE', async () => {
    const calls = install({ pages: 1, createWorkerError: true });
    expect(await run()).toEqual({ error: 'ENGINE_UNAVAILABLE' });
    expect(calls.rendered).toBe(0);
  });

  it('reports NO_TEXT when nothing was recognised', async () => {
    install({ pages: 1, words: [] });
    expect(await run()).toEqual({ error: 'NO_TEXT' });
  });

  it('reports progress per page and phase', async () => {
    install({ pages: 2, words: [word('Brutto', 30, 60, 90, 90)] });
    const progress: RecognitionProgress[] = [];
    await run(undefined, (p) => {
      progress.push(p);
    });
    expect(progress[0]).toMatchObject({ phase: 'LOADING', pageCount: 2 });
    expect(progress.some((p) => p.phase === 'RENDERING' && p.page === 2)).toBe(true);
    expect(progress.some((p) => p.phase === 'RECOGNISING' && p.fraction === 0.5)).toBe(true);
  });

  it('cancels in flight: terminates the worker and resolves CANCELLED', async () => {
    const calls = install({ pages: 1, recogniseNever: true });
    const controller = new AbortController();
    const pending = run(controller.signal);
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    expect(await pending).toEqual({ error: 'CANCELLED' });
    expect(calls.terminated).toBe(1);
    expect(calls.destroyed).toBe(1);
  });

  it('resolves CANCELLED without starting when already aborted', async () => {
    const calls = install({ pages: 1 });
    const controller = new AbortController();
    controller.abort();
    expect(await run(controller.signal)).toEqual({ error: 'CANCELLED' });
    expect(calls.createWorker).toHaveLength(0);
  });

  it('never logs document content', async () => {
    install({ pages: 1, words: [word('Geheim', 30, 60, 90, 90)] });
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    await run();
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain('Geheim');
  });
});

describe('scaleFor', () => {
  it('uses the default scale for payslip-sized pages', () => {
    expect(scaleFor(595, 842)).toBe(RENDER_SCALE);
  });

  it('reduces the scale to keep a page within the pixel budget', () => {
    const scale = scaleFor(3000, 4000);
    expect(scale).toBeLessThan(RENDER_SCALE);
    expect(3000 * scale * (4000 * scale)).toBeLessThanOrEqual(MAX_PAGE_PIXELS + 1);
  });
});
