import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  let messageService: MessageService;
  let handler: GlobalErrorHandler;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    messageService = new MessageService();
    vi.spyOn(messageService, 'add');
    handler = Object.assign(Object.create(GlobalErrorHandler.prototype), {
      messageService,
    }) as GlobalErrorHandler;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => consoleErrorSpy.mockRestore());

  it('logs and shows a toast (with correlationId) for an uncaught HttpErrorResponse', () => {
    const error = new HttpErrorResponse({
      error: { error: 'internal_server_error', message: 'oops', correlationId: 'corr-1' },
      status: 500,
    });

    handler.handleError(error);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: expect.stringContaining('corr-1') }),
    );
  });

  it('logs and shows a generic toast for a plain in-app error, triggering a UI response rather than leaving the page unresponsive', () => {
    handler.handleError(new Error('boom'));

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('unwraps an HttpErrorResponse nested under `.rejection` (zone.js unhandled-rejection shape)', () => {
    const error = new HttpErrorResponse({ error: { error: 'x', message: 'y' }, status: 502 });

    handler.handleError({ rejection: error });

    expect(messageService.add).toHaveBeenCalled();
  });
});
