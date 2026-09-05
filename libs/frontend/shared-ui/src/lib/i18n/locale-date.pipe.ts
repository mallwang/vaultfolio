import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/** Formats an ISO date string using the active locale's date conventions. Pure: false — re-evaluates when language signal changes. */
@Pipe({ name: 'localeDate', pure: false })
export class LocaleDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
    if (!value) return '—';
    // Parse YYYY-MM-DD as local date to avoid UTC-offset day shifts
    const [year, month, day] = value.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(this.i18n.language(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...options,
    }).format(date);
  }
}
