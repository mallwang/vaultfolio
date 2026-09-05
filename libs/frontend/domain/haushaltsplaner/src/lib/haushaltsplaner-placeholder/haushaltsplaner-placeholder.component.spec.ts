import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HaushaltsplanerPlaceholderComponent } from './haushaltsplaner-placeholder.component';

describe('HaushaltsplanerPlaceholderComponent', () => {
  let fixture: ComponentFixture<HaushaltsplanerPlaceholderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HaushaltsplanerPlaceholderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HaushaltsplanerPlaceholderComponent);
    fixture.detectChanges();
  });

  it('renders the domain name and "not yet available" copy', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Haushaltsplaner');
    expect(text).toContain('not yet available');
  });
});
