import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * Formats a full ISO 8601 timestamp (date + time) using the active locale's
 * conventions. Unlike `LocaleDatePipe` — which parses only the date part to
 * avoid UTC-offset day shifts for pure calendar dates (e.g. a purchase date)
 * — this pipe needs the actual instant, so it parses the whole ISO string.
 * Pure: false — re-evaluates when language signal changes.
 */
@Pipe({ name: 'localeDateTime', pure: false })
export class LocaleDateTimePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'medium',
      ...options,
    }).format(date);
  }
}
