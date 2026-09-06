---
name: 'speckit-sonar-validate'
description: 'Check the SonarQube Cloud quality gate for the current branch/PR via the sonarqube MCP server, before considering an implementation done.'
argument-hint: 'Optional branch or PR name (defaults to the current git branch/its open PR)'
compatibility: 'Requires spec-kit project structure with .specify/ directory, and the sonarqube MCP server (see .mcp.json) connected'
metadata:
  author: 'project-local'
  source: 'not part of upstream github-spec-kit — added to validate CI-based SonarQube Cloud analysis (see .github/workflows/ci.yml `sonar` job)'
user-invocable: true
disable-model-invocation: false
---

## Purpose

CI-based SonarQube Cloud analysis only runs after code is pushed, on the `sonar` job in `.github/workflows/ci.yml` (triggered on `pull_request` and on push to `main` — a branch with no open PR is never analyzed). Nothing in the local `speckit-implement` flow otherwise checks whether that job's quality gate is green — this skill closes that gap using the `sonarqube` MCP server (configured in `.mcp.json`, connected to SonarCloud).

**Always use the MCP tools for this** (`mcp__sonarqube__*`) — never shell out to `curl`/the SonarCloud Web API directly. This project deliberately standardized on the MCP server (see `.mcp.json`) instead of a hand-rolled script.

It is registered as an **optional** `after_implement` hook in `.specify/extensions.yml` (not mandatory): the gate can only reflect the last commit that was actually pushed and analyzed, which may lag the just-implemented tasks if they haven't been pushed yet, or if the branch has no open PR. Treat a missing/stale result as "nothing to validate yet", not a failure.

## User Input

```text
$ARGUMENTS
```

If given, treat it as a branch or PR-key override. Otherwise resolve automatically (see Execution).

## Execution

1. **Resolve the project key**: read `sonar.projectKey` from `sonar-project.properties` at the repo root (currently `mallwang_vaultfolio`). Only fall back to `mcp__sonarqube__search_my_sonarqube_projects` if that file is missing or doesn't match.

2. **Resolve what to check** (unless `$ARGUMENTS` already names a branch/PR):
   - Get the current git branch (`git rev-parse --abbrev-ref HEAD`).
   - If it's the repo's default branch (`main`): call `mcp__sonarqube__get_project_quality_gate_status` with `branch: "main"`.
   - Otherwise call `mcp__sonarqube__list_pull_requests` with the project key and look for a PR whose `branch` matches the current git branch, using its `key` as the `pullRequest` argument (never pass a git branch name as `pullRequest` — it must be the SonarQube PR key from this list).
   - If no matching PR is found and the branch isn't `main`: stop and tell the user this branch has no open PR yet, so CI's `sonar` job has never run against it — nothing to check until one is opened and CI completes.

3. **Call `mcp__sonarqube__get_project_quality_gate_status`** with the resolved `projectKey` and exactly one of `branch`/`pullRequest`.

4. **Interpret the result**:
   - `status: "OK"` → gate is green. Report that plainly, listing any conditions for context if the user wants detail.
   - `status: "ERROR"` → gate is red. List the failing `conditions` (metric, actual value vs. threshold). Ask the user whether to address them now or proceed anyway — mirror the "incomplete checklist" pattern in `speckit-implement` (stop and ask, never block silently, never silently ignore).
   - `status: "NONE"` / no result → no analysis exists yet for this ref. Tell the user to push (or wait for CI's `sonar` job to finish) before this check means anything — not a failure.

5. **For failing conditions the user wants to investigate further**, use `mcp__sonarqube__search_sonar_issues_in_projects` (scoped to the same `projects`/`branch`/`pullRequest`, `issueStatuses: ["OPEN"]`) to list the actual issues driving the metric, rather than guessing from the metric name alone.

## Done When

- [ ] Quality gate status resolved via the `sonarqube` MCP tools (never via a script or raw API call) and reported to the user
- [ ] A red gate is surfaced as a decision for the user, never silently ignored or silently blocking
- [ ] A missing/stale analysis is reported as "nothing to validate yet," not as a failure
