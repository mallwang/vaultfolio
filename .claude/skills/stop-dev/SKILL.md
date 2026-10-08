---
name: stop-dev
description: Stop leftover Nx/dev-server processes (nx run-many serve, nx run-executor, Nx daemon, ports 3000/4200/9229) so `npm run dev` can start again. Use when the user says dev won't start, Nx processes are still running, or asks to stop/kill the dev servers.
disable-model-invocation: true
---

# Stop leftover dev/Nx processes

Run this from the repo root, then report what it printed:

```bash
bash .claude/skills/stop-dev/stop-dev.sh
```

(Don't inline the `pkill -f` commands in the Bash call: the pattern would match the calling shell and kill it.)

Then tell the user they can run `npm run dev`. If "STILL BUSY" is printed, show the
`ss -ltnp` output for those ports instead of killing blindly.
