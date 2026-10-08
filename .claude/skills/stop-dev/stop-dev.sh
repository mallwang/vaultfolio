#!/usr/bin/env bash
# Stops leftover Nx/dev-server processes of this repo. Kept in a file so pkill -f
# patterns don't appear in the invoking shell's own command line (it would kill itself).
R="$(git rev-parse --show-toplevel)"
cd "$R" || exit 1
npx nx daemon --stop 2>&1 | tail -1
pkill -f "$R/node_modules/.*nx.*(run-many|run-executor|graph)"
pkill -f "nx run-many -t serve"
pkill -f "$R/node_modules/@nx/js/node_modules/.*source-map-support" # backend node child
sleep 1
for p in 3000 4200 9229; do fuser -k -n tcp $p 2>/dev/null; done
sleep 1
ss -ltn | grep -E ':(3000|4200|9229)\b' && echo "STILL BUSY" || echo "ports free"
exit 0
