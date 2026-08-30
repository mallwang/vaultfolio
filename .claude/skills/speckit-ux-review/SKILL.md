---
name: 'speckit-ux-review'
description: "Turn a feature spec's UI-relevant requirements into a reviewable static mockup (Artifact) before planning, then capture the approved layout as design.md."
argument-hint: 'Optional: feature directory (defaults to .specify/feature.json) or specific screens/states to mock up'
compatibility: 'Requires spec-kit project structure with .specify/ directory and a spec.md for the target feature'
metadata:
  author: 'project-local'
  source: 'adapted from a manual addition in another project, not part of upstream github-spec-kit'
user-invocable: true
disable-model-invocation: false
---

## Purpose

Spec Kit's `/speckit-specify` → `/speckit-plan` flow goes straight from prose requirements to an implementation plan. For UI-related features that skips the one review a product owner actually needs: seeing the shape of the thing before code gets written against it. This skill inserts that checkpoint.

It is **not** an official Spec Kit extension — there's no upstream mechanism for it, and it doesn't belong in `.specify/extensions/` because that hook system (`before_plan`, `after_specify`, …) is built for one-shot non-interactive scripts (commit, context-refresh). A UX review is a loop — mock up, look, revise — so it's implemented as an ordinary skill that uses the `Artifact` tool for the interactive part.

**When to run it**: after `/speckit-specify` (and `/speckit-clarify` if used), before `/speckit-plan`, for any feature whose spec describes layout, visual hierarchy, or new UI surfaces. Skip it for backend-only/data-only features — there's nothing to mock up.

**Vaultfolio context**: this is an Nx monorepo with an Angular frontend at `apps/frontend/`. PrimeNG is the project's chosen shared component library (see the project constitution and `specs/002-primeng-app-structure/spec.md`), but the mockup produced here is always static HTML/CSS — never real Angular/PrimeNG components — so it can be reviewed before any implementation exists. Where the mockup needs a plausible visual language (colors, spacing, component shapes), approximate PrimeNG's default look (e.g. the Aura preset) rather than inventing an unrelated style, so the reviewed layout doesn't mislead about what the real implementation will look like.

## User Input

```text
$ARGUMENTS
```

If empty, use the feature directory recorded in `.specify/feature.json`. If the user named specific screens/states/viewports, focus the mockup on those instead of covering every acceptance scenario.

## Execution

1. **Resolve the feature directory.**
   - Use `SPECIFY_FEATURE_DIRECTORY` from `.specify/feature.json` unless the user passed one explicitly in `$ARGUMENTS`.
   - Read `spec.md` from that directory. If it doesn't exist, stop and tell the user to run `/speckit-specify` first.

2. **Extract what's mockup-worthy.** Read the User Scenarios, Functional Requirements, and Key Entities sections. Pull out only what affects layout/visual hierarchy/interaction: regions and their proportions, what content lives where, states (empty/error/loading) called out in Edge Cases, responsive behavior. Ignore requirements that don't affect what's on screen (data-sourcing rules, validation logic, etc.) — note them as out-of-scope-for-mockup rather than silently dropping them.

3. **Check for design-relevant project conventions** before inventing new UI: look at the existing Angular app's current markup/styles (`apps/frontend/src/styles.css`, `apps/frontend/src/app/app.css`, `apps/frontend/src/app/app.html`, and any feature components under `apps/frontend/src/app/`) and any prior `design.md` files under `specs/*/design.md` so the mockup feels like it belongs to the same product, not a generic template. If the app has no real theme yet (common early in the project, before PrimeNG/theming is wired up — see step 0 note above), say so explicitly rather than silently inventing an unrelated look, and default to approximating PrimeNG's default (Aura) preset. Also check this skill's own `templates/` directory (see step 4) — the review-tool scaffold and app-header patterns are meant to be reused, not rebuilt.

4. **Start from `templates/review-shell.html`**, not a blank file. It's the reusable review-tool scaffold (banner, viewport/state switcher, stage frame, footer, toggle JS) extracted from the first mockup this skill produced — that chrome is identical in shape across features, so copy it into the new scratchpad file and fill in the `{{PLACEHOLDER}}` spots rather than reinventing it. There are two app-chrome pattern files, one per navigation context — pick whichever (or both) matches where the feature's screens live:
   - `templates/mocked-app-header-public.example.html` — screens directly under the base URL (sign-in, signup, invite/\*, account/\*): header only, no sidebar.
   - `templates/mocked-app-header-authenticated.example.html` — screens under `/app/*` (behind `authGuard`): sidebar + header, with the signed-in identity cluster (name, role badge, avatar, sign-out).

   Both include the theme-toggle control from `specs/010-theme-switch/design.md` in the header's right-hand cluster (alone on the public one, immediately before sign-out on the authenticated one) — it's part of the navigation bar shape now, mock it in even for unrelated features. Read whichever file(s) apply for the _pattern_ of representing the real app chrome inside the canvas (but re-derive markup/colors from the current `apps/frontend/src/app/core/layout/{app-shell,app-sidebar,app-header}` components and `apps/frontend/src/styles.css` — these are snapshots, not a source of truth, and may be stale, including whether the theme toggle has actually landed in `app-header.component.html` yet). A feature that mocks up both a public and an authenticated screen should include both headers as separate states/screens in the same review, not just one.
   - **First run in this project**: none of the template files exist yet. Create `templates/review-shell.html` as the generic scaffold described above (banner, viewport toggle for mobile/desktop, state toggle for the Edge Cases states, a stage frame that hosts the feature content, a footer noting this is a non-functional review mockup) before building the feature-specific content on top of it. Leave the `mocked-app-header-*.example.html` files for later, once a real app shell (e.g. the navigation shell from this very feature) exists to snapshot.

   Build the feature content itself as a static HTML file — no framework, no real data wiring, no live app logic. Use placeholder/lorem content that matches the _shape_ of real content (e.g. a plausible holding/ticker name, a fake sparkline rendered as an inline SVG, gray boxes captioned `[chart]` for visualizations that don't exist yet). Cover:
   - The primary/default state.
   - Any states the spec's Edge Cases call out (empty, error, loading) — one state-toggle button and one `data-show` visibility rule per state, following the mechanism already built into the shell template.
   - The breakpoint behavior described in the spec (e.g. stacked-on-mobile vs. split-on-desktop) — both live in the same shell via the viewport toggle, don't make the reviewer resize a window to find the second one.
   - **Before writing feature-specific HTML**, load the `artifact-design` skill to calibrate visual effort, and `artifact-diagramming` only if a diagram (not a UI mockup) is actually needed.

   After the mockup is approved (step 7), skim it for scaffold-level improvements (a clearer state-visibility pattern, a footer note worth keeping generic) that belong back in `templates/review-shell.html` for next time — but keep feature-specific content out of the template.

5. **Publish via the `Artifact` tool.** Pick a favicon and a title distinct from other mockups in this project. Put the file in the scratchpad directory. Give it a description noting it's a non-functional review mockup, not the real UI.

6. **Present the link and ask for feedback** using `AskUserQuestion` or plain text — whichever fits the kind of feedback needed (multiple-choice layout options vs. open-ended critique). Iterate: edit the file, redeploy via `Artifact` with the same `file_path` (and `url` if updating a previous session's artifact) to keep the same link stable across revisions.

7. **On explicit approval, save a local copy of the final HTML** as `specs/<feature>/mockup.html` — the Artifact link can go stale or be deleted later, so this file is the durable, offline-viewable copy.
   - Copy the scratchpad file you've been iterating on, not a re-fetch of the published Artifact — you already have the final source on disk.
   - If for some reason only the published Artifact is available (e.g. resuming a session where the scratchpad file is gone), fetch it with `WebFetch` on the `claude.ai/code/artifact/{uuid}` URL asking for the raw HTML source, then strip the injected `<!-- frame-runtime -->…<!-- /frame-runtime -->` script block and the frame-only `<meta>`/`<style>` tags before saving — that wrapper is Artifact-hosting plumbing, not part of the mockup. Keep everything from the mockup's own `<title>` tag onward, and wrap it in a standalone `<!doctype html><html>…</html>` document (own `<head>` with `<meta charset>`, the `<title>`, and the `<style>` block; `<body>` with the rest) so it opens correctly outside the Artifact frame.

8. **Write `specs/<feature>/design.md`** capturing:
   - A short description of the approved layout per region/state (prose + simple ASCII/markdown sketch if helpful — this file is read by `/speckit-plan` later, not rendered visually).
   - Which spec requirements/acceptance scenarios each region satisfies (so plan/tasks can trace back).
   - Explicitly out-of-scope-for-this-mockup items noted in step 2.
   - A note on how closely the mockup's visual language is expected to map onto the eventual real PrimeNG implementation (e.g. "approximates the Aura preset defaults; exact tokens to be finalized when PrimeNG theming is configured") when PrimeNG isn't wired up in the app yet.
   - A **Mockup** line linking to the local `mockup.html` (the durable copy) followed by the original Artifact URL for reference, noting the remote link may go stale — see existing `specs/*/design.md` files for the exact phrasing pattern.

9. **Add a one-line pointer in `spec.md`** near the top (e.g. under Input or as a new `**Design**` line) linking to `design.md`, so `/speckit-plan` and anyone reading the spec later finds it without being told.

## Done When

- [ ] Mockup published as an Artifact and reviewed with the user until they approve or explicitly say to move on without full approval
- [ ] Final HTML saved locally as `specs/<feature>/mockup.html`
- [ ] `specs/<feature>/design.md` written with the approved layout, requirement traceability, and links to both the local mockup and the original Artifact
- [ ] `spec.md` updated with a pointer to `design.md`
- [ ] User told they can now proceed to `/speckit-plan`
