#!/bin/bash
# Run a CPU/RAM-heavy command (tsc, vitest, vite build, Playwright runs) under a machine-wide
# 3-slot semaphore, because 7 build teams share 4 CPUs and 15 GB RAM.
# Usage: bash /tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/heavy.sh npm run typecheck
for i in $(seq 1 14400); do
  for s in 0 1 2; do
    exec 9>/tmp/ps-heavy-$s.lock
    if flock -n 9; then nice -n 5 "$@"; rc=$?; flock -u 9; exec 9>&-; exit $rc; fi
    exec 9>&-
  done
  sleep 1
done
echo "heavy.sh: timed out waiting for a slot" >&2; exit 99
