import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountOverviewPlaceholderComponent } from './account-overview-placeholder.component';

describe('AccountOverviewPlaceholderComponent', () => {
  let fixture: ComponentFixture<AccountOverviewPlaceholderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountOverviewPlaceholderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountOverviewPlaceholderComponent);
    fixture.detectChanges();
  });

  it('renders the domain name and "not yet available" copy', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Account Overview');
    expect(text).toContain('not yet available');
  });
});
