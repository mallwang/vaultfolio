import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TileValueComponent } from './tile-value.component';

@Component({
  imports: [TileValueComponent],
  template: `<app-tile-value>312.800 €</app-tile-value>`,
})
class HostComponent {}

describe('TileValueComponent', () => {
  it('projects the amount', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-tile-value')?.textContent,
    ).toBe('312.800 €');
  });
});
