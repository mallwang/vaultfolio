import { TestBed } from '@angular/core/testing';
import type { ExportFormat } from '@vaultfolio/export';
import { ExportFormatPreviewComponent } from './export-format-preview.component';

describe('ExportFormatPreviewComponent', () => {
  it.each<[ExportFormat, string]>([
    ['pdf', '.page'],
    ['xlsx', '.grid'],
    ['csv', '.code'],
    ['json', '.code'],
  ])('renders the %s preview as hidden decoration', (format, selector) => {
    const fixture = TestBed.createComponent(ExportFormatPreviewComponent);
    fixture.componentInstance.format = format;
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector(selector)).not.toBeNull();
  });
});
