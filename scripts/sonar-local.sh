#!/usr/bin/env bash
# Runs the repo's Sonar analysis fully locally: a SonarQube Community Build
# server (docker-compose.sonar.yml) plus the official scanner image, using the
# same sonar-project.properties and lcov reports as CI. Nothing is sent to
# SonarQube Cloud.
#
# Token: SONAR_LOCAL_TOKEN (a token created in the *local* server UI at
# http://localhost:9000 — not the cloud token). Never read from .env.
#
# Usage: npm run sonar:local            # reuses existing coverage/ reports
#        npm run sonar:local -- --cov   # runs `npm run test:coverage` first
set -euo pipefail

cd "$(dirname "$0")/.."

compose=(docker compose -f docker-compose.sonar.yml)
url="http://localhost:9000"

if [[ -z "${SONAR_LOCAL_TOKEN:-}" ]]; then
  cat >&2 <<MSG
SONAR_LOCAL_TOKEN is not set.
One-time setup: start the server (npm run sonar:local:up), open $url,
log in as admin/admin (you'll be asked to change the password), create a
token under My Account > Security, and export it as SONAR_LOCAL_TOKEN.
MSG
  exit 1
fi

"${compose[@]}" up -d

echo "Waiting for the local SonarQube server..."
until curl -fs "$url/api/system/status" | grep -q '"status":"UP"'; do
  sleep 5
done

if [[ "${1:-}" == "--cov" ]]; then
  npm run test:coverage
fi

version="$(node -p "require('./apps/frontend/package.json').version")"

docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e SONAR_TOKEN="$SONAR_LOCAL_TOKEN" \
  -e SONAR_HOST_URL="http://host.docker.internal:9000" \
  -v "$PWD:/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dsonar.projectKey=vaultfolio-local \
  -Dsonar.organization= \
  -Dsonar.projectVersion="$version"

echo "Results: $url/dashboard?id=vaultfolio-local"
