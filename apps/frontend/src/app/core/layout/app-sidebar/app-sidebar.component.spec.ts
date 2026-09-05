import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { AppSidebarComponent } from './app-sidebar.component';
import { CurrentUserStore } from '../../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../../auth/testing/current-user-store.testing';

const adminUser: SessionUser = {
  id: 'user-1',
  email: 'admin@example.com',
  displayName: 'Admin',
  role: 'ADMIN',
  domainScopes: [],
};

const memberUser: SessionUser = {
  id: 'user-2',
  email: 'member@example.com',
  displayName: 'Member',
  role: 'MEMBER',
  domainScopes: [],
};

describe('AppSidebarComponent', () => {
  let fakeCurrentUser: FakeCurrentUserStore;

  beforeEach(async () => {
    fakeCurrentUser = new FakeCurrentUserStore();
    await TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [provideRouter([]), { provide: CurrentUserStore, useValue: fakeCurrentUser }],
    }).compileComponents();
  });

  it('shows the Admin nav entry for an ADMIN user', async () => {
    fakeCurrentUser.setAuthenticated(adminUser);
    const fixture = TestBed.createComponent(AppSidebarComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Admin');
  });

  it('hides the Admin nav entry for a MEMBER user', async () => {
    fakeCurrentUser.setAuthenticated(memberUser);
    const fixture = TestBed.createComponent(AppSidebarComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Admin');
  });
});
