import { Component, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DynamicOutletComponent } from './dynamic-outlet.component';

@Component({
  selector: 'app-fake-widget',
  template: `fake widget content`,
})
class FakeWidgetComponent {}

describe('DynamicOutletComponent', () => {
  let fixture: ComponentFixture<DynamicOutletComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicOutletComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicOutletComponent);
  });

  it('renders nothing before the loader resolves', () => {
    let resolveLoader!: (type: Type<unknown>) => void;
    const loader = () =>
      new Promise<Type<unknown>>((resolve) => {
        resolveLoader = resolve;
      });

    fixture.componentRef.setInput('loader', loader);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
    // Keep the resolver reachable so the pending promise doesn't dangle past the test.
    void resolveLoader;
  });

  it('renders the resolved component after the loader resolves', async () => {
    fixture.componentRef.setInput('loader', () => Promise.resolve(FakeWidgetComponent));
    fixture.detectChanges();

    await Promise.resolve();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('fake widget content');
  });
});
