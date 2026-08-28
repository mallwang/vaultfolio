# Skill: Guided Release Workflow

Guides the developer through a human-reviewed release using **Nx Release** (`nx release`), Nx's
native versioning/changelog/publish tool — not `release-it`. Frontend and backend are released
together under one shared version number (`release.projectsRelationship: "fixed"` in `nx.json`,
covering the `frontend` and `backend` projects). Runs a dry-run preview, asks for explicit
confirmation, executes the release, and verifies the result.

**Important:** unlike a typical release script, a real (non-dry-run) `nx release` in this
workspace **commits, tags, pushes to `origin`, and creates the GitHub Release automatically** —
there is no separate manual "push + draft the release" step at the end. All of that happens the
moment the developer confirms in Step 4. Make sure the developer understands this before they
answer the confirmation prompt.

## Steps

### Step 1 — Branch check

Run:
```bash
git branch --show-current
```

If the output is not `main`, abort immediately with:
> "Must be on main branch to release. Currently on: `<branch>`."

### Step 2 — Clean working tree check

Run:
```bash
git status --porcelain
```

If the output is not empty, abort with:
> "Working tree has uncommitted changes — commit or stash before releasing."

List the dirty files from the output so the developer knows what to address.

### Step 3 — Determine if this is the first release

Run:
```bash
git tag -l "v*"
```

If the output is empty, this is the first release: append `--first-release` to the dry-run
command in Step 4 and to the real release command in Step 6. Without it, Nx Release cannot
determine a previous version/tag to diff from and will fail.

### Step 4 — Dry-run preview

Run:
```bash
npx nx release --dry-run
```
(append `--first-release` per Step 3 if applicable)

Display the **full output** to the developer. It shows, in order:
- the resolved version bump for both `frontend` and `backend` (they must match — that's the
  point of the fixed release group)
- the manifest diffs for `apps/frontend/package.json` and `apps/backend/package.json`
- the `CHANGELOG.md` entry that would be created/prepended
- the git commit/tag that would be created
- the GitHub Release that would be created at `https://github.com/<org>/<repo>/releases/tag/v<version>`

Every one of those sections is labelled `[dry-run]` and the command ends with the line:
```
NOTE: The "dryRun" flag means no changes were made.
```
If that closing line is missing, the dry run did not behave as a preview — stop immediately and
tell the developer:
> "The dry-run did not report itself as a no-op. Do not proceed — inspect `git log`, `git tag`,
> and the GitHub releases page for unexpected changes before doing anything else."

If the output indicates there are no conventional commits since the last tag to release (e.g. no
version bump section is produced), abort with:
> "Nothing to release — no conventional commits found since the last tag."

**Changelog review.** In addition to showing the full output, re-print just the `CHANGELOG.md`
section on its own (everything between `CREATE CHANGELOG.md [dry-run]` / `UPDATE CHANGELOG.md
[dry-run]` and the next blank-line-delimited block) as its own clearly labelled block, e.g.:

> **Proposed CHANGELOG.md entry for v`<version>`:**
> ```markdown
> <the changelog block, with the leading `+` diff markers stripped>
> ```

This is the same text that will be committed to `CHANGELOG.md` and used verbatim as the GitHub
Release body — the developer should read it here, not just skim the wider dry-run log.

### Step 5 — Confirmation gate

Ask the developer:
> "Proceed with release v`<version>`? This will commit the version bump, write the CHANGELOG.md
> entry shown above, tag it, **push to origin**, and **create the GitHub Release with that same
> text automatically**. (yes/no)"

- If the answer is **no** (or anything other than yes/y): abort with "Release cancelled."
- If the answer is **yes** / **y**: continue to Step 6.

### Step 6 — Run release

Run:
```bash
npx nx release --skip-publish
```
(append `--first-release` per Step 3 if applicable)

`--skip-publish` is passed because neither app is published to a registry (both apps are
deployed, not `npm publish`ed); Nx Release would otherwise try to prompt about a publish step.

Wait for the command to complete. Display the output.

### Step 7 — Verify result

After the release command completes:

1. Read `apps/frontend/package.json` and `apps/backend/package.json` and confirm both `version`
   fields were bumped to the same new version, matching what Step 4 previewed.
2. Read `CHANGELOG.md` at the workspace root and confirm a new section header exists for that
   version (e.g. `## 0.2.0 (2026-08-28)`).
3. Run `git tag -l "v<version>"` and confirm the tag exists.
4. Confirm the GitHub Release exists — the release command's own output includes the
   `CREATE https://github.com/<org>/<repo>/releases/tag/v<version>` line without a `[dry-run]`
   suffix; report that URL back to the developer.

If any check fails, report the discrepancy clearly and stop:
> "Release verification failed: `<specific issue>`. Please investigate — the tag/push/GitHub
> Release may be in a partial state."

### Step 8 — Done

Report the new version number and the GitHub Release URL to the developer. No further action is
needed — the push and the GitHub Release were already handled in Step 6.
