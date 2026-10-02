import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

/**
 * State for a PrimeNG `<p-tabs>` container whose tabs are child routes (Settings, Admin, Holdings
 * area): `activeTab` mirrors the active child route segment (falling back to `defaultTab`) so a
 * direct visit opens the right tab, and `onTabChange` navigates to the selected tab's route so
 * the URL stays in sync. Must be called in an injection context (a field initializer).
 */
export function routeTabs(defaultTab: string) {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const currentTab = (): string => route.snapshot.firstChild?.url[0]?.path ?? defaultTab;

  const activeTab = toSignal(
    router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(currentTab),
      startWith(currentTab()),
    ),
    { initialValue: defaultTab },
  );

  const onTabChange = (value: string | number | undefined): void => {
    if (value === undefined) return;
    void router.navigate([String(value)], { relativeTo: route });
  };

  return { activeTab, onTabChange };
}
