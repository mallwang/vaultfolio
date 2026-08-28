---
name: generate-pr
description: Generate a conventional-commit PR title and copy-paste-ready markdown PR description from the current branch's diff against main. Use when asked to "generate a PR description", "write a pull request", "create PR title", or "draft PR".
---

# Generate Pull Request Description

Produces a conventional-commit PR title and a structured markdown PR description by analysing the diff of the current branch against `main`.

## Steps

### 1. Gather git context

Run these commands (they are fast and safe):

```bash
git log main...HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD
```

Use the log to understand the sequence of commits and spot the overall intent.
Use the stat to identify which packages/directories changed.
Use the full diff to understand what specifically changed in each file.

### 2. Produce the PR title

Format: `<type>(<scope>): <short imperative summary>`

**Type** — pick one:

- `feat` — new user-visible behaviour
- `fix` — bug fix
- `refactor` — no behaviour change
- `test` — tests only
- `docs` — documentation / spec files only
- `chore` — tooling, config, deps
- `ci` — CI / build pipeline

**Scope** — the tightest meaningful grouping, e.g. an Nx project/library name (`backend`, `frontend`, `domain-valuation`, `shared-types`) or a cross-cutting concern (`db`, `auth`). Omit if the change is truly repo-wide.

**Summary** — imperative mood, ≤60 chars, no period. Describes the _what_ a developer cares about, not an implementation detail.

Example: `feat(domain-valuation): add look-through allocation aggregation for ETF holdings`

### 3. Produce the PR description

Output **only** the markdown block below — no preamble, no explanation. The user will copy-paste it directly into GitHub.

Follow this structure exactly:

```markdown
## Summary

- <bullet 1 — user-visible behaviour or high-level change>
- <bullet 2>
- <bullet 3, if applicable>

## What changed

**<Nx project or layer name>** (`<apps|libs path if applicable>`)

- `<file or symbol>`: <one-line description of the change>
- …

**<Next project or layer>**

- …
```

**Rules for Summary bullets:**

- 2–4 bullets maximum
- Each bullet covers one coherent user-facing or architectural change
- Mention concrete artefacts (field names, enum values, endpoints) when they fit in one line
- Write in present tense ("Adds X", "Normalises Y", "Migrates Z automatically")

**Rules for What changed sections:**

- Group by Nx project or architectural layer (e.g. **Backend** `apps/backend`, **Frontend**
  `apps/frontend`, a specific library under `libs/` such as **Domain — Valuation**
  `libs/domain-valuation`, **Shared** `libs/shared-*`, **Specs**, **CI**, …)
- Include the `apps/`/`libs/` path in parentheses only when it adds clarity
- List only files/symbols that are non-trivially changed — skip generated lock files, minor formatting
- Each bullet: backtick the filename or symbol, colon, plain-English change
- Keep spec/docs files in their own section (e.g. **Specs**) so reviewers can skip them
- If a change touches monetary/decimal handling (Principle III/Stack Decision — `NUMERIC` columns,
  decimal library usage), call that out explicitly rather than folding it into a generic bullet

### 4. Output format

Wrap the entire output in a single triple-backtick code fence so the user can copy raw markdown and paste it directly into GitHub's PR form. The fence itself must not have a language tag. Print the title on its own line inside the fence, then a blank line, then the markdown description. Example:

````
```
feat(domain-valuation): add look-through allocation aggregation for ETF holdings

## Summary

- Adds look-through allocation aggregation that resolves ETF constituent weights against a holding's percentage of the portfolio
- Backend exposes the aggregated allocation via a new `GET /portfolio/allocation` endpoint
- Frontend portfolio overview renders the look-through breakdown alongside direct holdings

## What changed

**Domain — Valuation** (`libs/domain-valuation`)
- `allocation.ts`: added `computeLookThroughAllocation`, combining direct holdings with ETF constituent weights; uses the project's decimal library throughout, no native `number` for weights or values
- `allocation.spec.ts`: exact-value tests for overlapping exposure across a directly held share and two ETFs

**Backend** (`apps/backend`)
- `portfolio.controller.ts`: new `GET /portfolio/allocation` endpoint, delegates to `domain-valuation`
- `portfolio.module.ts`: wires the new endpoint into the existing `PortfolioModule`

**Frontend** (`apps/frontend`)
- `portfolio-overview.component.ts`: fetches and renders the look-through allocation table
- `allocation-row.component.ts`: new component for a single aggregated allocation row

**Specs**
- `specs/004-lookthrough-allocation/`: spec, plan, tasks, data-model, API docs, quickstart, requirements checklist added
```
````

## Notes

- Ignore commits whose messages start with `[Spec Kit]` or `docs(spec-kit):` when deriving the PR title — those are housekeeping commits added by tooling.
- If the diff contains only spec/docs changes, use type `docs` and scope `specs`.
- Do not include a "Test plan" section — the project's CI covers that.
- If the diff skips test-first for money-handling code, or otherwise deviates from a Core
  Principle in the [constitution](../../../.specify/memory/constitution.md), add a short
  **Constitution deviations** section explicitly justifying it — the constitution requires this
  to be documented in the PR description rather than left implicit.
