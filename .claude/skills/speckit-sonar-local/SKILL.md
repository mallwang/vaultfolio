---
name: 'speckit-sonar-local'
description: 'Run the Sonar analysis fully locally (SonarQube Community Build in Docker, no cloud upload) and report findings, so issues are caught before the CI/SonarQube Cloud scan.'
argument-hint: 'Optional: "--cov" to force a fresh coverage run first'
compatibility: 'Requires Docker, npm, and SONAR_LOCAL_TOKEN (token of the local server, exported in ~/.bashrc)'
metadata:
  author: 'project-local'
  source: 'project-local — wraps scripts/sonar-local.sh and docker-compose.sonar.yml'
user-invocable: true
disable-model-invocation: false
---

## Purpose

A local pre-push counterpart to `/speckit-sonar-validate`: it catches findings _before_ the CI `sonar` job runs, using the same `sonar-project.properties` and lcov reports, but against a local SonarQube Community Build server. Nothing is sent to SonarQube Cloud.

It is **not identical** to the cloud: the Community Build lags SonarQube Cloud on newly released rules (e.g. S9382, S9383, S7503 were missing locally), so a clean local scan does not guarantee a clean cloud scan. Treat it as an early filter, and still run `/speckit-sonar-validate` after the push.

Registered as an **optional** `after_implement` hook in `.specify/extensions.yml` (runs after `speckit.coverage`, before `speckit.sonar.validate`).

## User Input

```text
$ARGUMENTS
```

## Execution

1. **Check prerequisites** (never read `.env`/secrets): `docker` is available and `SONAR_LOCAL_TOKEN` is set in the environment. If the token is only in `~/.bashrc`, load just that line (`eval "$(grep -E '^\s*export SONAR_LOCAL_TOKEN=' ~/.bashrc | tail -1)"`) and never print it. If either is missing, stop and point the user to the one-time setup in `scripts/sonar-local.sh`.

2. **Run the scan**: `npm run sonar:local` — add `-- --cov` if `$ARGUMENTS` says so, or if `coverage/` is missing/older than the latest source changes (the `speckit.coverage` hook usually just refreshed it). The script starts the server if needed and waits for it.

3. **Fetch results** from the local server (`http://localhost:9000`, basic auth with `SONAR_LOCAL_TOKEN` as user, empty password) for project `vaultfolio-local`: `api/issues/search?componentKeys=vaultfolio-local&resolved=false&ps=500` (the analysis is processed asynchronously — retry for a few seconds if the issue list is still from the previous run) and `api/qualitygates/project_status?projectKey=vaultfolio-local`.

4. **Report**: gate status, plus findings grouped by rule with file:line. Restrict attention to files changed on this branch (`git diff --name-only main...HEAD`) when the user cares about the feature's own issues; pre-existing findings elsewhere are context, not blockers.

5. **Ask, don't block**: offer to fix findings in the branch's changed files; never silently ignore or force a fix. A gate/finding mismatch with the cloud is expected (see Purpose).

## Done When

- [ ] Local scan ran (or the missing prerequisite was reported)
- [ ] Gate status and findings in this branch's changed files reported
- [ ] Any fixes were the user's decision
