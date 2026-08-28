#!/bin/sh
# Runs via nginx's own /docker-entrypoint.d/ hook mechanism, before nginx
# starts (nginx's base entrypoint runs every script here, then execs the
# real CMD itself — this script must not exec anything). Angular's
# environment.ts is baked into the static bundle at build time, so it can't
# read docker-compose `environment:` vars — this writes a small script the
# built app reads at runtime instead, letting a container-level env var
# configure it per deployment without rebuilding the image.
set -eu

cat > /usr/share/nginx/html/env.js <<EOF
window.__env = {
  primengLicenseKey: "${PRIMENG_LICENSE_KEY:-}"
};
EOF
