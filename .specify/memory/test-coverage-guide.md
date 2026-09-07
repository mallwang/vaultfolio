# Test Coverage Guide

This document defines what must be tested, what must not, and how to measure coverage for this
project. It is read by any agent implementing or reviewing code, and drives the `/speckit-coverage`
audit skill.

---

## Principle: test logic, not wiring

A spec file's value is proportional to the decision-making code it exercises. Files that only
declare data, configure providers, or bootstrap the application have no branches to assert — a
test for them just proves you can type correctly, not that the code works.

---

## Always skip — no spec file needed

| Pattern                                                          | Reason                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `**/main.ts`                                                     | Single `bootstrapApplication()` call — untestable by design |
| `**/app.config.ts`                                               | Provider wiring — Angular tests this machinery              |
| `**/app.routes.ts`                                               | Route definitions — no logic                                |
| `**/*-placeholder.component.ts`                                  | Intentional stub, zero logic until feature is built         |
| `**/application-areas.ts`                                        | Pure data array (nav config), no functions                  |
| Components whose entire body is a template with no class methods | Asserting "it renders" adds noise; skip until logic appears |

These patterns are already excluded from the Vitest coverage report in `vitest-base.config.ts`
so they do not drag down the measured percentage. If new always-skip patterns are added here,
add the corresponding glob to the `test.coverage.exclude` array there too.

---

## Always test — spec file required

| File type                     | Examples                                              |
| ----------------------------- | ----------------------------------------------------- |
| Services (HTTP, state)        | `*.service.ts`                                        |
| Guards                        | `*.guard.ts`                                          |
| Resolvers                     | `*.resolver.ts`                                       |
| Pipes with logic              | `*.pipe.ts`                                           |
| Components with class methods | Any component that has methods beyond lifecycle hooks |
| Pure-function util files      | Field-config maps, formatters, validators             |

---

## Established Angular testing patterns for this codebase

### Basic TestBed setup

```ts
await TestBed.configureTestingModule({
  imports: [MyStandaloneComponent],
  providers: [provideHttpClient(), provideHttpClientTesting()],
}).compileComponents();

fixture = TestBed.createComponent(MyStandaloneComponent);
httpMock = TestBed.inject(HttpTestingController);
fixture.detectChanges();
```

### Component-level DI (critical)

When a component declares `providers: [SomeService]` in its `@Component` decorator, the service
instance is **component-level**, not module-level. Use `fixture.debugElement.injector.get()`
instead of `TestBed.inject()` — otherwise you get a different instance and spies have no effect:

```ts
// WRONG — different instance
const svc = TestBed.inject(ConfirmationService);

// CORRECT — same instance the component uses
const svc = fixture.debugElement.injector.get(ConfirmationService);
```

### `ConfirmationService.confirm()` — fluent API

`confirm()` returns `ConfirmationService` itself (fluent). Mocks must return `cs`:

```ts
vi.spyOn(cs, 'confirm').mockImplementation((opts) => {
  opts.accept?.();
  return cs; // required
});
```

### Signals

Access signal values with a call: `comp['loading']()`, `comp['submitError']()`.
Set writable signals directly: `comp['submitError'].set('msg')`.

### Inputs and ngOnChanges

```ts
// @Input via setInput
fixture.componentRef.setInput('account', account);

// Testing ngOnChanges manually
import { SimpleChange } from '@angular/core';
comp.account = account;
comp.ngOnChanges({ account: new SimpleChange(null, account, false) });
```

### Private/protected member access

Use bracket notation: `comp['form']`, `comp['submit']()`.

### ECharts in jsdom

Tests for components that render `<app-echart>` must mock the `echarts` module and stub
`ResizeObserver`. See `holdings.component.spec.ts` and `dashboard.component.spec.ts` for the
established pattern.

---

## Coverage targets (SonarQube quality gate)

The quality gate enforces a minimum coverage threshold on new code (see `sonar-project.properties`
and the `sonar` CI job). Use `/speckit-sonar-validate` after pushing to check the gate status.

`/speckit-coverage` is a standalone backlog audit — run it on demand to decide which spec files to
write next, not as part of a feature implementation cycle.
