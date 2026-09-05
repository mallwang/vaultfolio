import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InsurancesPlaceholderComponent } from './insurances-placeholder.component';

describe('InsurancesPlaceholderComponent', () => {
  let fixture: ComponentFixture<InsurancesPlaceholderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsurancesPlaceholderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InsurancesPlaceholderComponent);
    fixture.detectChanges();
  });

  it('renders the domain name and "not yet available" copy', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Insurances');
    expect(text).toContain('not yet available');
  });
});
