---
name: 'speckit-coverage'
description: 'Run a full test-coverage audit: execute all project tests with coverage, rank projects by statement coverage (lowest first), and classify every uncovered source file as test/skip per the test-coverage-guide.'
argument-hint: 'Optional: a single project name to audit just that project (e.g. frontend)'
compatibility: 'Requires Nx workspace with Vitest-based test targets and npm as the package manager'
metadata:
  author: 'project-local'
  source: 'project-local — see .specify/memory/test-coverage-guide.md for the classification rules'
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

If a project name is given, scope steps 1–3 to that project only. Otherwise audit all projects.

## Purpose

Provides a repeatable, sorted picture of test coverage so that the next spec files to write are
always obvious. Complements `/speckit-sonar-validate` (which checks the CI-side quality gate after
push) by giving a local pre-push view.

Classification rules live in `.specify/memory/test-coverage-guide.md` — read it before step 3.

---

## Execution

### Step 1 — Run coverage

If `$ARGUMENTS` names a specific project:

```
npm exec nx run <project>:test -- --coverage
```

Otherwise run all projects:

```
npm exec nx run-many -- --target=test --all --coverage
```

Capture stdout/stderr to a temp file (`/tmp/coverage-out.txt`) so you can parse it without
losing the output:

```
npm exec nx run-many -- --target=test --all --coverage 2>&1 | tee /tmp/coverage-out.txt
```

If any test suite fails, note the failures but continue — coverage data for the passing suites is
still useful.

### Step 2 — Parse project-level summaries

Vitest v8 (the coverage provider used here) prints a per-project text-summary block like:

```
% Coverage report from v8
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
...
All files |   68.01 |    55.20 |   71.43 |   68.01 |
```

For each project that produced coverage output, extract the `All files` row and build a table:

| Project | Statements | Branches | Functions |
| ------- | ---------- | -------- | --------- |
| ...     | ...        | ...      | ...       |

Sort by **statement coverage ascending** (lowest first). Projects at 100% go at the bottom.

### Step 3 — Classify unspec'd files in low-coverage projects

For every project whose statement coverage is below **80 %**, find source files that have no
corresponding spec:

```bash
find <project-src-dir> -name "*.ts" \
  ! -name "*.spec.ts" \
  ! -name "index.ts" \
  ! -name "*.d.ts" | while read f; do
    base="${f%.ts}"
    [ ! -f "${base}.spec.ts" ] && echo "$f"
  done
```

For each file found, classify it using `.specify/memory/test-coverage-guide.md`:

- **SKIP** — matches a "always skip" pattern (placeholder, bootstrap, pure data, etc.)
- **TEST** — contains logic (service, guard, component with methods, util functions)

Then sort the **TEST** files by line count descending (largest uncovered surface first) using `wc -l`.

### Step 4 — Report

Output the following sections:

#### Coverage by project (lowest first)

A markdown table with project, statement %, branch %, function %. Flag projects below 80% in bold.

#### Files to spec (per project, sorted by line count desc)

For each low-coverage project with TEST-classified unspec'd files:

```
**<project-name>** (<statement>% statements)

| File | Lines | Priority |
|------|-------|----------|
| path/to/service.ts | 79 | HIGH |
| path/to/component.ts | 51 | MEDIUM |
```

Priority guidance:

- **HIGH**: services, guards — pure logic, no browser rendering required
- **MEDIUM**: components with methods
- **LOW**: small utility files < 30 lines

#### Files deliberately skipped

List the SKIP-classified files so the reader can confirm the classification is correct.

#### Suggested next action

Name the single highest-priority TEST file across all projects and suggest the literal command to
start writing its spec (e.g. "Start with `auth.service.ts` — run the existing pattern from
`account-overview-page.component.spec.ts` as a template").

---

## Done When

- [ ] Coverage run completed (failures noted if any, not blocking)
- [ ] Project table produced, sorted lowest-first
- [ ] Every unspec'd file in sub-90% projects classified as TEST or SKIP
- [ ] TEST files sorted by line count and labelled with priority
- [ ] Single next-action recommendation given
