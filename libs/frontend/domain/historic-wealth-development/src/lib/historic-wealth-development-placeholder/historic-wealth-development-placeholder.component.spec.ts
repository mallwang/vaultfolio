import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistoricWealthDevelopmentPlaceholderComponent } from './historic-wealth-development-placeholder.component';

describe('HistoricWealthDevelopmentPlaceholderComponent', () => {
  let fixture: ComponentFixture<HistoricWealthDevelopmentPlaceholderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoricWealthDevelopmentPlaceholderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoricWealthDevelopmentPlaceholderComponent);
    fixture.detectChanges();
  });

  it('renders the domain name and "not yet available" copy', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Historic Wealth Development');
    expect(text).toContain('not yet available');
  });
});
