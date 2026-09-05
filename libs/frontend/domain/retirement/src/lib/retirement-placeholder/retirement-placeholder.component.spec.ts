import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RetirementPlaceholderComponent } from './retirement-placeholder.component';

describe('RetirementPlaceholderComponent', () => {
  let fixture: ComponentFixture<RetirementPlaceholderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RetirementPlaceholderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RetirementPlaceholderComponent);
    fixture.detectChanges();
  });

  it('renders the domain name and "not yet available" copy', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Retirement');
    expect(text).toContain('not yet available');
  });
});
